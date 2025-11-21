# Automatic Student Role Cleanup

## Feature Overview

When a Super Admin assigns an elevated role to a user, the system **automatically removes** the default "student" role to keep the role list clean and prevent confusion.

## How It Works

### 1. New User Registration
- User logs in for the first time
- System creates user with **"student"** role (default)
- User can access student portal

### 2. Role Promotion
Super Admin assigns an elevated role via:
- Super Admin Dashboard → Users → Click role button
- API: `POST /api/users/[clerkId]/role` with elevated role

**Elevated Roles:**
- `admin` (Priority 3)
- `senior_admin` (Priority 4)
- `super_admin` (Priority 5)
- `committee` (Priority 2)

### 3. Automatic Cleanup
When elevated role is assigned:
1. ✅ New role is added to `user_roles` table
2. ✅ System automatically removes "student" role
3. ✅ User now only has elevated role
4. ✅ Role cache is invalidated

**Before:**
```
User: john@example.com
Roles: [student]
```

**After Promotion to Admin:**
```
User: john@example.com
Roles: [admin]  ← student role auto-removed
```

## Code Implementation

### Backend (API Route)
**File:** `src/app/api/users/[clerkId]/role/route.ts`

```typescript
// After assigning elevated role:
const elevatedRoles: UserRole[] = ["admin", "senior_admin", "super_admin", "committee"];
if (elevatedRoles.includes(role as UserRole)) {
  const currentRoles = await getUserRoles(clerkId);
  const hasStudentRole = currentRoles.some(r => r.role === "student");
  
  if (hasStudentRole) {
    await removeUserRole(clerkId, "student");
    console.log(`Auto-removed student role from ${clerkId} after assigning ${role}`);
  }
}
```

### Frontend (UI Indicator)
**File:** `src/components/admin/IntegratedUserManagement.tsx`

When viewing a user with "student" role, a helpful tip is shown:
```
💡 Tip: Assigning an elevated role (Admin, Super Admin, Committee) will automatically remove the Student role.
```

## Role Priority System

When a user has multiple roles, the system picks the **highest priority** role:

| Role | Priority | Access Level |
|------|----------|--------------|
| super_admin | 5 | Full system access + user management |
| senior_admin | 4 | Extended admin features |
| admin | 3 | Standard admin features |
| committee | 2 | Committee-specific features |
| student | 1 | Basic student features |

**Implementation:**
- `src/lib/db-roles.ts` → `getUserRoleFromDB()` uses `ROLE_PRIORITY`
- `src/lib/get-role-fast.ts` → Middleware also implements priority logic

## Manual Role Management (Optional)

If you need to manually manage roles:

### Add Role (Script)
```bash
node scripts/make-super-admin.js <clerk_user_id>
```

### Remove Student Role (Script)
```bash
node scripts/remove-student-role.js <clerk_user_id>
```

This script:
- ✅ Checks if user has other roles first
- ❌ Prevents removal if student is the only role
- ✅ Safe to use for cleanup

### Check User Roles (Script)
```bash
node scripts/check-user-role.js <clerk_user_id>
```

Shows all roles assigned to a user with timestamps.

## Benefits

### 1. **Cleaner Data**
- Users don't accumulate unnecessary roles
- Database queries are faster (fewer joins)
- Role lists are easier to audit

### 2. **Clear Intent**
- User is either "student" OR "admin/committee/etc"
- No ambiguity about user's purpose
- Easier to understand user's access level

### 3. **Better Performance**
- Fewer role checks in queries
- Smaller `user_roles` table
- Less cache memory usage

### 4. **Security**
- Clear separation between student and staff
- Prevents accidental privilege mixing
- Easier to audit elevated access

## Edge Cases Handled

### Case 1: Demoting Back to Student
If admin is demoted back to student:
```typescript
// User: john@example.com
// Roles: [admin] → Demoted to [student]
await setUserRole(clerkId, "student");
// Result: Keeps student, admin still exists but not used
```

**Note:** System picks highest priority, so if admin role still exists, user still has admin access. To fully demote:
```typescript
await removeUserRole(clerkId, "admin");
await setUserRole(clerkId, "student");
```

### Case 2: API Failure During Cleanup
If cleanup fails, elevated role is **still assigned**:
```typescript
try {
  await removeUserRole(clerkId, "student");
} catch (error) {
  console.warn("Failed to auto-remove student role:", error);
  // Don't fail the request - elevated role is already assigned
}
```

User will have both roles temporarily, but system picks highest priority (elevated role wins).

### Case 3: Multiple Elevated Roles
User can have multiple elevated roles:
```
Roles: [admin, committee]
Primary Role: admin (higher priority)
```

Student role is removed when **any** elevated role is assigned.

## Testing Checklist

- [ ] New user gets "student" role on first login
- [ ] Promoting to admin removes student role
- [ ] Promoting to super_admin removes student role
- [ ] Promoting to committee removes student role
- [ ] User without student role is not affected
- [ ] UI shows helpful tip for students
- [ ] Role priority system picks highest role
- [ ] Cache is invalidated after role change
- [ ] Failed cleanup doesn't break role assignment

## Migration Notes

**Existing Users:**
- Users with both "student" and elevated roles will continue to work
- System automatically picks highest priority role
- Optional: Run cleanup script to remove student role from all elevated users

**Cleanup Script:**
```bash
# Create a script to clean up all elevated users
node scripts/cleanup-student-roles.js
```

(Script not created - add if needed for bulk cleanup)
