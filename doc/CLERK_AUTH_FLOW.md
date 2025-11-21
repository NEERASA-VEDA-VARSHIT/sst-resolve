# Clerk Authentication Flow - Current Implementation

## Overview

This document explains what happens when a new user logs in using Clerk Next.js and how it integrates with the database schema.

## Current Flow (Before New Schema)

### 1. User Signs Up/Signs In with Clerk

```
User → Clerk Sign-In/Sign-Up Page → Clerk Authentication
```

**What Happens:**
- User provides email/password (or OAuth)
- Clerk creates/manages user account externally
- Clerk returns `userId` (Clerk's internal ID)
- No database record created yet

### 2. Middleware Authentication Check

**File:** `src/middleware.ts`

```typescript
const { userId, sessionClaims } = await auth();
const role = sessionClaims?.metadata?.role;
```

**What Happens:**
- Middleware extracts `userId` from Clerk session
- Gets `role` from `sessionClaims.metadata.role` (stored in Clerk's publicMetadata)
- Role defaults to `null` or `"student"` if not set
- No database lookup - all from Clerk session

### 3. User Profile Linking (Manual)

**File:** `src/app/api/profile/route.ts`

**Current Flow:**
1. User visits `/profile` page
2. User enters their `userNumber` (e.g., "24bcs10005")
3. System stores `userNumber` in Clerk's `publicMetadata`
4. System creates/updates record in `students` table

**Code:**
```typescript
// Link userNumber to Clerk user
await client.users.updateUser(userId, {
  publicMetadata: {
    ...user.publicMetadata,
    userNumber: userNumber.trim(),
  },
});

// Create/update student profile
await db.insert(students).values({
  userNumber: currentUserNumber,
  fullName, email, roomNumber, mobile, hostel
}).onConflictDoUpdate(...);
```

### 4. Role Assignment (Manual by Super Admin)

**File:** `src/app/(app)/dashboard/admin/actions.ts`

**Current Flow:**
1. Super Admin assigns role via UI
2. Role stored in Clerk's `publicMetadata.role`
3. If admin/super_admin, also creates record in `staff` table

**Code:**
```typescript
await client.users.updateUser(targetId, {
  publicMetadata: { role: targetRole },
});
```

## Current Data Storage

### Clerk (External Service)
- `userId` - Clerk's internal user ID
- `email` - User email
- `publicMetadata.role` - User role ("student", "admin", "super_admin", "committee")
- `publicMetadata.userNumber` - Student user number (linked manually)

### Database (Current Schema)
- `students` table - Created when user links their userNumber
- `staff` table - Created when admin/super_admin role is assigned

### What's Missing
- ❌ No `users` table record (new schema has this)
- ❌ No automatic sync between Clerk and database
- ❌ User must manually link userNumber
- ❌ Role must be manually assigned by super_admin

## New Schema Integration Plan

With the new schema, we need to:

1. **Create `users` table record** when user first authenticates
2. **Sync Clerk data** with `users` table
3. **Link `students` table** via `user_id` FK (not just userNumber)
4. **Link `staff` table** via `clerk_user_id` (already exists)

## Proposed Flow (With New Schema)

### Option 1: Webhook-Based (Recommended)

Create a Clerk webhook endpoint to sync users automatically:

```typescript
// src/app/api/webhooks/clerk/route.ts
export async function POST(request: NextRequest) {
  const event = await request.json();
  
  if (event.type === 'user.created') {
    // Create user record in database
    await db.insert(users).values({
      clerk_id: event.data.id,
      email: event.data.email_addresses[0]?.email_address,
      name: `${event.data.first_name} ${event.data.last_name}`,
    });
  }
  
  if (event.type === 'user.updated') {
    // Sync user data
    await db.update(users)
      .set({
        email: event.data.email_addresses[0]?.email_address,
        name: `${event.data.first_name} ${event.data.last_name}`,
      })
      .where(eq(users.clerk_id, event.data.id));
  }
}
```

### Option 2: Lazy Creation (Current Approach Enhanced)

Create user record on first access:

```typescript
// In middleware or API route
async function ensureUserExists(userId: string) {
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  
  // Check if user exists in database
  const [existingUser] = await db.select()
    .from(users)
    .where(eq(users.clerk_id, userId))
    .limit(1);
  
  if (!existingUser) {
    // Create user record
    await db.insert(users).values({
      clerk_id: userId,
      email: clerkUser.emailAddresses[0]?.emailAddress,
      name: `${clerkUser.firstName} ${clerkUser.lastName}`,
    });
  }
}
```

### Option 3: Profile Update Creates User (Hybrid)

When user updates profile, ensure user record exists:

```typescript
// In /api/profile route
const [dbUser] = await db.select()
  .from(users)
  .where(eq(users.clerk_id, userId))
  .limit(1);

if (!dbUser) {
  // Create user record
  await db.insert(users).values({
    clerk_id: userId,
    email: clerkUser.emailAddresses[0]?.emailAddress,
    name: `${clerkUser.firstName} ${clerkUser.lastName}`,
  });
}

// Then create/update student profile with FK
await db.insert(students).values({
  user_id: dbUser.id, // FK to users table
  user_number: userNumber, // Keep for backward compatibility
  ...
});
```

## Recommended Implementation

### Step 1: Create User Sync Utility

```typescript
// src/lib/user-sync.ts
export async function syncUserFromClerk(userId: string) {
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  
  const [user] = await db.insert(users).values({
    clerk_id: userId,
    email: clerkUser.emailAddresses[0]?.emailAddress || '',
    name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim(),
    phone: clerkUser.phoneNumbers[0]?.phoneNumber || null,
  }).onConflictDoUpdate({
    target: users.clerk_id,
    set: {
      email: clerkUser.emailAddresses[0]?.emailAddress || '',
      name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim(),
      phone: clerkUser.phoneNumbers[0]?.phoneNumber || null,
      updated_at: new Date(),
    },
  }).returning();
  
  return user;
}
```

### Step 2: Update Profile Route

```typescript
// In /api/profile route
// 1. Sync user from Clerk
const dbUser = await syncUserFromClerk(userId);

// 2. Link userNumber to Clerk publicMetadata (existing)
if (userNumber) {
  await client.users.updateUser(userId, {
    publicMetadata: { userNumber },
  });
}

// 3. Create/update student with FK
await db.insert(students).values({
  user_id: dbUser.id, // NEW: FK to users
  user_number: userNumber, // OLD: Keep for compatibility
  roll_no: userNumber, // NEW: Can be same as user_number
  ...
});
```

### Step 3: Update Middleware (Optional)

```typescript
// In middleware, ensure user exists
if (userId) {
  await syncUserFromClerk(userId); // Lazy creation
}
```

## ✅ Implementation Status

### Completed

1. ✅ **User Sync Utility** (`src/lib/user-sync.ts`)
   - `syncUserFromClerk()`: Syncs user from Clerk to database
   - `getOrCreateUser()`: Gets or creates user record
   - `getUserRole()`: Gets role from Clerk publicMetadata
   - `getUserNumber()`: Gets userNumber from Clerk publicMetadata

2. ✅ **Profile Route Updated** (`src/app/api/profile/route.ts`)
   - Updates `users` table: `fullName → name`, `email → email`, `mobile → phone`
   - Updates `students` table: `userNumber → roll_no`, `roomNumber → room_no`, `hostel → hostel`
   - Maintains backward compatibility with old fields
   - Handles both new schema (FK) and old schema (user_number)

3. ✅ **Clerk Webhook Created** (`src/app/api/webhooks/clerk/route.ts`)
   - Auto-creates users on signup (`user.created`)
   - Auto-updates users on profile changes (`user.updated`)
   - Handles user deletion (`user.deleted`)
   - Uses Svix for webhook verification
   - **Setup**: See `WEBHOOK_SETUP.md` for detailed instructions

4. ✅ **Schema Updated** (`src/db/schema.ts`)
   - Added backward compatibility fields to `students` table:
     - `user_number`, `full_name`, `email`, `room_number`, `mobile`
   - New schema fields:
     - `user_id` (FK to users), `roll_no`, `room_no`, `hostel`
   - Both old and new fields work simultaneously

## Current State Summary

| Step | Current | With New Schema |
|------|---------|----------------|
| User signs up | ✅ Clerk creates account | ✅ Clerk creates account |
| User record in DB | ✅ Auto-created via webhook | ✅ Auto-created (webhook/lazy) |
| Role assignment | ✅ Manual via UI | ✅ Manual via UI (same) |
| userNumber linking | ✅ Manual via profile | ✅ Manual via profile (same) |
| Student profile | ✅ Created on profile update | ✅ Created with FK to users |
| Staff profile | ✅ Created on role assignment | ✅ Created with FK to users |

## Migration Path

1. **Keep existing flow** - No breaking changes
2. **Add user sync** - Create `users` table records
3. **Update profile route** - Link students via FK
4. **Gradual migration** - Old code still works, new code uses FK

## Questions to Consider

1. **Should users be auto-created?** (Webhook vs Lazy)
2. **Should roles be synced to `roles` table?** (Currently only in Clerk)
3. **Should we migrate existing Clerk users?** (One-time script)
4. **How to handle SSO/email changes?** (Sync on update)

