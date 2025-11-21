# User Sync Security Fixes - Database Migration Required

## Overview
Fixed 5 critical security and data integrity issues in user sync logic.

## Required Database Migration

### Add Unique Constraint on clerk_id (if not exists)

```sql
-- Check if constraint already exists
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'users' 
  AND constraint_type = 'UNIQUE' 
  AND constraint_name LIKE '%clerk_id%';

-- Add unique constraint if missing (prevents race condition duplicates)
ALTER TABLE users 
ADD CONSTRAINT users_clerk_id_key UNIQUE(clerk_id);
```

**Why**: Prevents race condition where two simultaneous requests could create duplicate user records. The constraint ensures database-level uniqueness enforcement.

## Fixes Applied

### ❌ FIX #1: clerkClient Usage
**Status**: ✅ **Not an issue** - Your codebase correctly uses `await clerkClient()` pattern.

### ✅ FIX #2: Removed Destructive Orphan User Handling
**Before:**
```typescript
// Overwrites clerk_id, breaking account mapping forever
await db.update(users).set({
  clerk_id: `DELETED_${clerkUserId}_${Date.now()}`,
});
```

**After:**
```typescript
// Just log and return null - preserves data integrity
console.warn(`Clerk user not found - skipping sync`);
return null;
```

**Impact**: 
- ✅ Preserves ticket history
- ✅ Doesn't break account mapping on temporary Clerk errors
- ✅ Students won't lose access if Clerk has transient issues

### ✅ FIX #3: Removed Email-Based Sync (SECURITY CRITICAL)
**Before:**
```typescript
// DANGEROUS: Allows account hijacking
const [existingUserByEmail] = await db
  .select()
  .from(users)
  .where(eq(users.email, email))
  .limit(1);

if (existingUserByEmail) {
  // Overwrites clerk_id of existing user!
  await db.update(users).set({ clerk_id: newClerkUserId });
}
```

**After:**
```typescript
// REMOVED - Only sync by clerk_id (unique identifier)
// Student emails are auto-generated (rollno@domain.com)
// Two Clerk accounts with same roll number = same email = COLLISION
```

**Attack Scenario Prevented**:
1. Student A signs up: `rollno: 24bcs10001` → `email: 24bcs10001@domain.com`
2. Attacker creates new Clerk account with same roll number
3. Attacker's account would overwrite Student A's `clerk_id`
4. Student A loses access, attacker gains access to all tickets

**Now**: Only `clerk_id` (unique) is used for sync. Email collisions are impossible.

### ✅ FIX #4: Role Detection from Clerk Metadata
**Before:**
```typescript
// Always assigns "student" role, even if admin logs in
const studentRoleId = await getOrCreateRole("student");
```

**After:**
```typescript
// Gets role from Clerk publicMetadata
const roleName = (clerkUser.publicMetadata as any)?.role || "student";
const roleId = await getOrCreateRole(roleName);
```

**Expected Clerk Metadata:**
```typescript
publicMetadata: {
  role: "student" | "admin" | "super_admin" | "committee",
  userNumber: "24bcs10001" // for students
}
```

**Impact**:
- ✅ Admins get correct role on first login
- ✅ Committee members get correct role
- ✅ Still defaults to "student" if metadata missing

### ✅ FIX #5: Race Condition Handling
**Before:**
```typescript
// No handling - two simultaneous requests could create duplicates
const [newUser] = await db.insert(users).values(userData).returning();
```

**After:**
```typescript
try {
  const [newUser] = await db.insert(users).values(userData).returning();
  return newUser;
} catch (insertError) {
  // Handle unique constraint violation (race condition)
  if (insertError.code === '23505' && insertError.constraint_name?.includes('clerk_id')) {
    console.warn(`Race condition detected - fetching existing user`);
    const [existingUser] = await db.select().from(users)
      .where(eq(users.clerk_id, clerkUserId)).limit(1);
    return existingUser;
  }
  throw insertError;
}
```

**Impact**:
- ✅ Gracefully handles simultaneous requests
- ✅ Relies on database constraint for atomic uniqueness
- ✅ No duplicate users created

## Testing Checklist

- [ ] Run database migration to add unique constraint
- [ ] Test student signup flow
- [ ] Test admin first login (verify role assignment)
- [ ] Test existing user login (verify no duplicates)
- [ ] Test deleted Clerk user scenario (verify graceful handling)

## Rollback Plan

If issues arise:

```sql
-- Rollback: Remove constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_clerk_id_key;
```

Then revert code changes via git.

## Security Impact

🔴 **HIGH** - Fix #3 prevents account hijacking vulnerability  
🟡 **MEDIUM** - Fix #2 prevents data corruption  
🟡 **MEDIUM** - Fix #4 prevents privilege escalation  
🟢 **LOW** - Fix #5 prevents rare duplicate user records

**Recommendation**: Deploy immediately, especially Fix #3.
