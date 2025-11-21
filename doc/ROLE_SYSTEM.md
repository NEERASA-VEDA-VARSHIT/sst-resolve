# Database-Only Role System

## Overview

**Roles are stored ONLY in the database, not in Clerk metadata.** The database is the single source of truth for user roles.

## How It Works

### 1. User Creation (Automatic)

When a new user signs up:

1. **Clerk creates the user** → Triggers `user.created` webhook
2. **Webhook handler** (`/api/webhooks/clerk`) receives the event
3. **Database record created** with default role = `"student"`
4. **Role assigned** via `users.role_id` → `roles.id` foreign key

**Every new user automatically becomes a STUDENT** unless manually promoted.

### 2. Role Retrieval

To get a user's role:

```typescript
import { getUserRoleFromDB } from "@/lib/db-roles";

const role = await getUserRoleFromDB(clerkUserId);
// Returns: "student" | "admin" | "super_admin" | "committee"
```

### 3. Role Assignment

To change a user's role:

```typescript
import { setUserRole } from "@/lib/db-roles";

await setUserRole(clerkUserId, "admin");
```

## Database Schema

### `roles` Table
```sql
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(64) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### `users` Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  clerk_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(256) UNIQUE NOT NULL,
  role_id INTEGER REFERENCES roles(id), -- FK to roles table
  ...
);
```

## Default Roles

The system includes 4 default roles:

1. **`student`** - Default role for all new users
2. **`admin`** - Administrators managing tickets
3. **`super_admin`** - Full system access
4. **`committee`** - Committee members managing tagged tickets

## Initialization

Run this script once to create default roles:

```bash
pnpm run db:init-roles
```

Or manually:

```sql
INSERT INTO roles (name, description) VALUES
  ('student', 'Default role for all students'),
  ('admin', 'Administrator role for managing tickets'),
  ('super_admin', 'Super administrator with full system access'),
  ('committee', 'Committee member role for managing tagged tickets');
```

## Migration from Clerk Metadata

If you have existing users with roles in Clerk metadata:

1. **Run initialization script** to create roles in DB
2. **Migrate existing roles** from Clerk to database:

```typescript
// Migration script example
const clerkUsers = await clerkClient.users.getUserList();
for (const clerkUser of clerkUsers) {
  const clerkRole = clerkUser.publicMetadata?.role;
  if (clerkRole) {
    await setUserRole(clerkUser.id, clerkRole);
  }
}
```

## Key Files

- **`src/lib/db-roles.ts`** - Role management utilities
- **`src/app/api/webhooks/clerk/route.ts`** - Webhook handler (creates users with default role)
- **`src/app/page.tsx`** - Homepage routing (uses DB roles)
- **`src/types/auth.ts`** - Type definitions

## Benefits

✅ **Single source of truth** - Roles in database only  
✅ **Automatic assignment** - New users default to "student"  
✅ **Easy promotion** - Change roles via database  
✅ **Audit trail** - Role changes tracked in database  
✅ **No Clerk dependency** - Roles independent of Clerk metadata  

## Security Notes

- **Default role is "student"** - Most restrictive by default
- **Role changes require admin access** - Use `setUserRole()` with proper authorization
- **Database is authoritative** - Clerk metadata is ignored for roles

