# User Flow Documentation: What Happens When a New User Opens `http://localhost:3000/`

This document explains the complete flow of what happens when a user visits the homepage (`http://localhost:3000/`) and how the application handles authentication, user creation, role assignment, and redirection for each role type.

## Table of Contents

1. [Overview](#overview)
2. [Flow Diagram](#flow-diagram)
3. [Detailed Flow by Role](#detailed-flow-by-role)
   - [Unauthenticated User](#unauthenticated-user)
   - [New Student (First-Time Sign-In)](#new-student-first-time-sign-in)
   - [Existing Student](#existing-student)
   - [Admin](#admin)
   - [Senior Admin](#senior-admin)
   - [Super Admin](#super-admin)
   - [Committee Member](#committee-member)
4. [Key Files and Their Responsibilities](#key-files-and-their-responsibilities)
5. [Database Schema](#database-schema)
6. [Role System](#role-system)

---

## Overview

When a user visits `http://localhost:3000/`, the application follows this general flow:

1. **Middleware Check** (`src/middleware.ts`) - Lightweight authentication check
2. **Homepage Route** (`src/app/page.tsx`) - Determines if user is authenticated
3. **User Sync** (`src/lib/user-sync.ts`) - Ensures user exists in database
4. **Role Retrieval** (`src/lib/db-roles.ts`) - Gets user's role from database
5. **Dashboard Redirection** (`src/types/auth.ts`) - Redirects to appropriate dashboard
6. **Layout Protection** (Role-specific layouts) - Additional authorization checks

---

## Flow Diagram

```
User visits http://localhost:3000/
         |
         v
┌─────────────────────────────┐
│   Middleware (Edge Runtime) │
│   - Check authentication    │
│   - Lightweight role check  │
└─────────────────────────────┘
         |
         v
┌─────────────────────────────┐
│   Homepage (page.tsx)       │
│   - Check userId            │
└─────────────────────────────┘
         |
    ┌────┴────┐
    |         |
No userId  Has userId
    |         |
    v         v
┌─────────┐  ┌──────────────────────────┐
│ Landing │  │ getOrCreateUser()        │
│  Page   │  │ - Sync from Clerk        │
│         │  │ - Create if missing      │
└─────────┘  └──────────────────────────┘
                    |
                    v
         ┌──────────────────────────┐
         │ getUserRoleFromDB()       │
         │ - Query user_roles table │
         │ - Return highest priority│
         └──────────────────────────┘
                    |
                    v
         ┌──────────────────────────┐
         │ getDashboardPath()       │
         │ - Map role to dashboard  │
         └──────────────────────────┘
                    |
        ┌───────────┴───────────┐
        |                       |
    Student        Admin/Senior Admin/
                   Super Admin/Committee
        |                       |
        v                       v
┌──────────────┐      ┌─────────────────┐
│ Profile      │      │ Role-specific    │
│ Check        │      │ Dashboard        │
│ (if needed)  │      │ (with domain/    │
│              │      │  scope filtering)│
└──────────────┘      └─────────────────┘
```

---

## Detailed Flow by Role

### Unauthenticated User

**Flow:**
1. User visits `http://localhost:3000/`
2. **Middleware** (`src/middleware.ts`): Route `/` is public, allows through
3. **Homepage** (`src/app/page.tsx`): `auth()` returns `null` for `userId`
4. **Result**: Renders `<LandingPage />` component

**Files Involved:**
- `src/middleware.ts` (lines 5-11) - Defines public routes
- `src/app/page.tsx` (lines 12-17) - Checks `userId` and renders landing page
- `src/components/landing/LandingPage.tsx` - Landing page UI

**What User Sees:**
- Landing page with hero section and features
- Sign-in/Sign-up buttons

---

### New Student (First-Time Sign-In)

**Flow:**
1. User signs up via Clerk (redirected to `/sign-up`)
2. **Clerk Webhook** (`src/app/api/webhooks/clerk/route.ts`):
   - Receives `user.created` event
   - Calls `syncUserFromClerk()` to create user in database
   - Assigns default "student" role via `user_roles` table
   - **Note**: If webhook fails or is delayed, `getOrCreateUser()` acts as a backup path (see step 5)
3. User visits `http://localhost:3000/` after sign-in
4. **Middleware** (`src/middleware.ts`): User authenticated, allows through
   - **Security Note**: Middleware uses Clerk metadata for lightweight checks only. All API routes and layouts MUST check role from the database, never from Clerk metadata. This prevents privilege escalation attacks from forged JWT metadata.
5. **Homepage** (`src/app/page.tsx`):
   - `getOrCreateUser(userId)` - Ensures user exists (idempotent)
     - **Backup Path**: If Clerk webhook failed, this creates the user record now
     - **Idempotent**: Safe to call multiple times, won't create duplicates
   - `getUserRoleFromDB(userId)` - Returns "student" (default role)
     - **Fallback**: If `user_roles` returns empty list, defaults to "student"
   - `getDashboardPath("student")` - Returns `/student/dashboard`
   - Redirects to `/student/dashboard`
6. **Student Dashboard Layout** (`src/app/(app)/student/dashboard/layout.tsx`):
   - Checks `isProfileComplete(userId)` via `src/lib/profile-check.ts`
   - If profile incomplete → Redirects to `/profile`
   - If profile complete → Renders dashboard

**Files Involved:**
- `src/app/api/webhooks/clerk/route.ts` - Webhook handler for user creation
- `src/lib/user-sync.ts` - User synchronization logic
- `src/lib/db-roles.ts` - Role retrieval (defaults to "student")
- `src/app/page.tsx` - Homepage redirection logic
- `src/app/(app)/student/dashboard/layout.tsx` - Profile completeness check
- `src/lib/profile-check.ts` - Profile validation logic
- `src/app/(app)/profile/page.tsx` - Profile completion page

**Database Operations:**
1. `users` table: Insert new user record
2. `user_roles` table: Insert role assignment (role_id = 1 for "student")
3. `students` table: May be created later when profile is filled

**What User Sees:**
- Redirected to `/profile` if profile incomplete
- Profile form to fill required fields:
  - User Number (roll_no)
  - Full Name
  - Email
  - Mobile Number
  - Room Number
  - Hostel
  - Class Section
  - Batch Year
- After profile completion → Redirected to `/student/dashboard`

---

### Existing Student

**Flow:**
1. User visits `http://localhost:3000/` (already signed in)
2. **Middleware**: User authenticated, allows through
3. **Homepage**:
   - `getOrCreateUser(userId)` - User exists, returns existing record
   - `getUserRoleFromDB(userId)` - Returns "student"
   - Redirects to `/student/dashboard`
4. **Student Dashboard Layout**:
   - `isProfileComplete(userId)` - Returns `true` (profile already complete)
   - Renders dashboard

**Files Involved:**
- Same as "New Student" but skips webhook and profile creation steps

**What User Sees:**
- Direct redirect to `/student/dashboard`
- Student dashboard with ticket list, create ticket button, etc.

---

### Admin

**Flow:**
1. User visits `http://localhost:3000/` (signed in as admin)
2. **Middleware**: User authenticated, allows through
   - Middleware checks Clerk metadata for lightweight routing
   - **Security**: Full authorization happens in layout (database check)
3. **Homepage**:
   - `getOrCreateUser(userId)` - Ensures user exists
   - `getUserRoleFromDB(userId)` - Returns "admin" (from `user_roles` table, highest priority if multiple roles)
   - `getDashboardPath("admin")` - Returns `/admin/dashboard`
   - Redirects to `/admin/dashboard`
4. **Admin Dashboard Layout** (`src/app/(app)/admin/dashboard/layout.tsx`):
   - **Database Authorization**: Verifies role is "admin", "senior_admin", or "super_admin" from database
   - If not → Redirects to `/student/dashboard`
   - If yes → Renders admin dashboard
   - **Note**: Admin may have scoped access (domain/scope). Dashboard can filter tickets based on user's assigned domains/scopes.

**Files Involved:**
- `src/app/page.tsx` - Homepage redirection
- `src/lib/db-roles.ts` - Role retrieval (queries `user_roles` table)
- `src/app/(app)/admin/dashboard/layout.tsx` - Admin authorization check
- `src/app/(app)/admin/dashboard/page.tsx` - Admin dashboard UI

**How Admin Role is Assigned:**
- Admin role is assigned manually via:
  - Super Admin creates staff member via `/superadmin/dashboard/forms` (SPOC Assignments tab)
  - Or directly via API: `POST /api/admin/staff` with role "admin"
- Creates entry in `staff` table and `user_roles` table

**What User Sees:**
- Redirected to `/admin/dashboard`
- Admin dashboard with:
  - Ticket list (assigned to this admin)
  - Ticket filters (status, category, etc.)
  - Ticket management actions

---

### Senior Admin

**Flow:**
1. User visits `http://localhost:3000/` (signed in as senior admin)
2. **Middleware**: User authenticated, allows through
3. **Homepage**:
   - `getOrCreateUser(userId)` - Ensures user exists
   - `getUserRoleFromDB(userId)` - Returns "senior_admin" (from `user_roles` table)
   - `getDashboardPath("senior_admin")` - Returns `/admin/dashboard` (uses admin dashboard)
   - Redirects to `/admin/dashboard`
4. **Admin Dashboard Layout** (`src/app/(app)/admin/dashboard/layout.tsx`):
   - **Database Authorization**: Verifies role is "admin", "senior_admin", or "super_admin" from database
   - If not → Redirects to `/student/dashboard`
   - If yes → Renders admin dashboard
   - **Note**: Senior Admin typically sees escalated tickets and can supervise admins in their domain/scope

**How Senior Admin Role is Assigned:**
- Senior admin role is assigned manually via:
  - Super Admin creates staff member via `/superadmin/dashboard/forms` (SPOC Assignments tab) with role "senior_admin"
  - Creates entry in `staff` table and `user_roles` table with domain/scope
- Can be scoped: e.g., Senior Admin for Hostel (Neeladri) vs Hostel (Velankani)

**What User Sees:**
- Redirected to `/admin/dashboard`
- Admin dashboard with escalated tickets and admin supervision capabilities

---

### Super Admin

**Flow:**
1. User visits `http://localhost:3000/` (signed in as super admin)
2. **Middleware**: User authenticated, allows through
3. **Homepage**:
   - `getOrCreateUser(userId)` - Ensures user exists
   - `getUserRoleFromDB(userId)` - Returns "super_admin" (highest priority role)
   - `getDashboardPath("super_admin")` - Returns `/superadmin/dashboard`
   - Redirects to `/superadmin/dashboard`
4. **Super Admin Dashboard Layout** (`src/app/(app)/superadmin/dashboard/layout.tsx`):
   - **Database Authorization**: Verifies role is "super_admin" from database
   - If not → Redirects to `/student/dashboard`
   - If yes → Renders super admin dashboard

**Files Involved:**
- `src/app/page.tsx` - Homepage redirection
- `src/lib/db-roles.ts` - Role retrieval (returns highest priority role)
- `src/app/(app)/superadmin/dashboard/layout.tsx` - Super admin authorization check
- `src/app/(app)/superadmin/dashboard/page.tsx` - Super admin dashboard UI

**How Super Admin Role is Assigned:**
- Super admin role is assigned manually via:
  - Database migration or direct SQL
  - Or via API: `POST /api/admin/staff` with role "super_admin"
- Creates entry in `staff` table and `user_roles` table

**What User Sees:**
- Redirected to `/superadmin/dashboard`
- Super admin dashboard with:
  - All tickets (no filtering by assignment)
  - Form Management (SPOC assignments, Committees, Escalation Rules)
  - Analytics and reports

---

### Committee Member

**Flow:**
1. User visits `http://localhost:3000/` (signed in as committee member)
2. **Middleware**: User authenticated, allows through
3. **Homepage**:
   - `getOrCreateUser(userId)` - Ensures user exists
   - `getUserRoleFromDB(userId)` - Returns "committee"
   - `getDashboardPath("committee")` - Returns `/committee/dashboard`
   - Redirects to `/committee/dashboard`
4. **Committee Dashboard Layout** (`src/app/(app)/committee/dashboard/layout.tsx`):
   - Verifies role is "committee"
   - If not → Redirects to `/student/dashboard`
   - If yes → Renders committee dashboard

**Files Involved:**
- `src/app/page.tsx` - Homepage redirection
- `src/lib/db-roles.ts` - Role retrieval
- `src/app/(app)/committee/dashboard/layout.tsx` - Committee authorization check
- `src/app/(app)/committee/dashboard/page.tsx` - Committee dashboard UI

**How Committee Role is Assigned:**
- Committee role is assigned via:
  - Super Admin creates committee via `/superadmin/dashboard/forms` (Committees tab)
  - Adds members to committee via "Manage Members" button
  - Creates entry in `committees` table, `committee_members` table, and `user_roles` table

**What User Sees:**
- Redirected to `/committee/dashboard`
- Committee dashboard with:
  - Tickets tagged to their committee (by admins)
  - Tickets they created (as students)
  - Committee-specific actions (view, comment, close tagged tickets)

**Important**: Committees are helper roles, NOT part of the escalation chain. They only see tickets that admins explicitly tag to their committee. Escalated tickets do NOT automatically go to committees.

---

## Key Files and Their Responsibilities

### Authentication & Authorization

| File | Purpose | Key Functions |
|------|---------|---------------|
| `src/middleware.ts` | Edge runtime middleware for route protection | - Lightweight auth check<br>- Route matchers for roles<br>- Profile check for students |
| `src/app/page.tsx` | Homepage route handler | - Checks authentication<br>- Syncs user to database<br>- Gets role and redirects |
| `src/lib/user-sync.ts` | User synchronization utility | - `syncUserFromClerk()`<br>- `getOrCreateUser()`<br>- Handles duplicate emails |
| `src/lib/db-roles.ts` | Database role management | - `getUserRoleFromDB()`<br>- `getOrCreateRole()`<br>- `setUserRole()`<br>- `removeUserRole()` |

### Role-Specific Layouts

| File | Purpose | Key Checks |
|------|---------|------------|
| `src/app/(app)/student/dashboard/layout.tsx` | Student dashboard protection | - Profile completeness check<br>- Redirects to `/profile` if incomplete |
| `src/app/(app)/admin/dashboard/layout.tsx` | Admin dashboard protection | - Verifies role is "admin", "senior_admin", or "super_admin" |
| `src/app/(app)/superadmin/dashboard/layout.tsx` | Super admin dashboard protection | - Verifies role is "super_admin" |
| `src/app/(app)/committee/dashboard/layout.tsx` | Committee dashboard protection | - Verifies role is "committee" |

### Profile Management

| File | Purpose | Key Functions |
|------|---------|---------------|
| `src/lib/profile-check.ts` | Profile completeness validation | - `isProfileComplete()`<br>- `getMissingProfileFields()` |
| `src/app/(app)/profile/page.tsx` | Profile completion page | - Profile form UI<br>- Form validation<br>- API submission |
| `src/app/api/profile/route.ts` | Profile API endpoint | - GET: Fetch profile<br>- POST: Update profile |

### Webhooks

| File | Purpose | Events Handled |
|------|---------|----------------|
| `src/app/api/webhooks/clerk/route.ts` | Clerk webhook handler | - `user.created`<br>- `user.updated`<br>- `user.deleted` |

### Type Definitions

| File | Purpose | Key Types |
|------|---------|-----------|
| `src/types/auth.ts` | Authentication types | - `UserRole` type<br>- `getDashboardPath()` function |

---

## Database Schema

### Core Tables

**`users`** - Base user table
- `id` (UUID, primary key)
- `clerk_id` (varchar, unique) - Clerk user ID
- `email` (varchar)
- `name` (varchar)
- `phone` (varchar)
- `created_at`, `updated_at` (timestamps)

**`roles`** - Role definitions
- `id` (serial, primary key)
- `name` (varchar) - "student", "admin", "senior_admin", "super_admin", "committee"
- `description` (text)

**`user_roles`** - Multi-role join table
- `id` (serial, primary key)
- `user_id` (UUID, FK to `users.id`)
- `role_id` (integer, FK to `roles.id`)
- `domain` (varchar, nullable) - Optional domain scope
- `scope` (varchar, nullable) - Optional scope
- `granted_by` (UUID, FK to `users.id`, nullable)
- `created_at` (timestamp)

**`students`** - Student-specific data
- `id` (serial, primary key)
- `user_id` (UUID, FK to `users.id`)
- `roll_no` (varchar)
- `room_no` (varchar)
- `hostel` (enum)
- `class_section` (enum)
- `batch_year` (integer)
- `mobile` (varchar)
- `email` (varchar)
- `full_name` (varchar)

**`staff`** - Admin/super admin data
- `id` (serial, primary key)
- `user_id` (UUID, FK to `users.id`, unique)
- `clerk_user_id` (varchar, deprecated, nullable)
- `full_name` (varchar)
- `email` (varchar)
- `domain` (varchar) - "Hostel" or "College"
- `scope` (varchar, nullable) - e.g., "Neeladri", "Velankani"

**`committees`** - Committee definitions
- `id` (serial, primary key)
- `name` (varchar)
- `description` (text)
- `contact_email` (varchar)

**`committee_members`** - Committee membership
- `id` (serial, primary key)
- `committee_id` (integer, FK to `committees.id`)
- `user_id` (UUID, FK to `users.id`)
- `role` (varchar, nullable) - Committee-specific role

---

## Role System

### Role Hierarchy

Roles have a priority system (used when user has multiple roles):

1. **super_admin** (priority: 5) - Highest privilege, final escalation authority
2. **senior_admin** (priority: 4) - Handles escalations from Admin, supervises admins
3. **admin** (priority: 3) - Ground-level administrator, first responders
4. **committee** (priority: 2) - Helper role for collaborative ticket resolution (NOT part of escalation chain)
5. **student** (priority: 1) - Default role for all new users

**Note**: Committee is a helper role that acts when tickets are tagged to them. Committees are NOT part of the escalation chain (Admin → Senior Admin → Super Admin).

### Domain and Scope-Aware Roles

**Important**: Roles are global, but authority is **domain- and scope-specific** via the `user_roles.domain` and `user_roles.scope` fields.

This means:
- A user can be `SENIOR_ADMIN` for Hostel (Neeladri) and `SENIOR_ADMIN` for Hostel (Velankani) as separate role assignments
- A user can be `ADMIN` for College (CSE) and `COMMITTEE` member for Cultural Committee simultaneously
- Escalation chains are configured per domain/scope via the `escalation_rules` table, not hardcoded by role name

**Example Multi-Role User:**
```
User: John Doe
├── ADMIN (domain: Hostel, scope: Neeladri)
├── SENIOR_ADMIN (domain: College, scope: CSE)
└── COMMITTEE (domain: College, scope: Cultural Committee)
```

When this user visits the homepage:
- `getUserRoleFromDB()` returns `"senior_admin"` (highest priority)
- Dashboard redirects to `/admin/dashboard`
- But API routes can check specific roles: `userHasRole(userId, "admin", "Hostel", "Neeladri")` → `true`

**Important**: Even though this user has a COMMITTEE role, they are NOT part of the escalation chain. The COMMITTEE role only allows them to manage tickets explicitly tagged to the Cultural Committee.

### Role Assignment Flow

1. **New User Sign-Up:**
   - Clerk webhook receives `user.created` event
   - `syncUserFromClerk()` creates user in `users` table
   - Default "student" role assigned in `user_roles` table

2. **Admin/Super Admin Assignment:**
   - Super admin creates staff member via `/superadmin/dashboard/forms`
   - Creates entry in `staff` table
   - Assigns role in `user_roles` table with domain/scope

3. **Committee Assignment:**
   - Super admin creates committee via `/superadmin/dashboard/forms`
   - Adds members to committee
   - Assigns "committee" role in `user_roles` table

### Multi-Role Support

Users can have multiple roles simultaneously:
- Example: User can be both "admin" (for Hostel domain) and "committee" (for College committee)
- `getUserRoleFromDB()` returns the **highest priority** role for dashboard redirection
- **Important**: Priority matters only for dashboard redirection. API permissions use `hasRole()` which checks ANY matching role, not just the primary role.

**Multi-Role Precedence:**
- Dashboard redirection uses highest priority role
- API route permissions check ALL roles (via `userHasRole()` or `isAdmin()`)
- This allows users to have different capabilities in different domains/scopes

**Example:**
```typescript
// User has: ADMIN (Hostel Neeladri) + COMMITTEE (Cultural)
const primaryRole = await getUserRoleFromDB(userId); // Returns "admin" (priority 3 > 2)
redirect(getDashboardPath(primaryRole)); // → /admin/dashboard

// But API can check specific role:
const canHandleHostelTicket = await userHasRole(userId, "admin", "Hostel", "Neeladri"); // true
const canHandleCommitteeTicket = await userHasRole(userId, "committee"); // true
```

### Escalation Chain

The escalation flow follows: **Admin → Senior Admin → Super Admin**

**Important**: 
- Escalation levels are determined per domain/scope via the `escalation_rules` table, not hardcoded by role name.
- **Committees are NOT part of the escalation chain**. Committees are helper roles that only act when tickets are explicitly tagged to them by admins. They do not receive escalated tickets automatically.

**Example Escalation Rules:**
- Hostel (Neeladri): Level 1 = ADMIN, Level 2 = SENIOR_ADMIN, Level 3 = SUPER_ADMIN
- College (CSE): Level 1 = ADMIN, Level 2 = SENIOR_ADMIN, Level 3 = SUPER_ADMIN
- Each domain/scope can have different staff members at each level

**Committee Role:**
- Committees are **separate from escalation** - they are helper groups
- Admins can tag tickets to committees for collaborative resolution
- Committees can view and manage tickets tagged to them
- Committees can close tickets tagged to their committee
- Committees do NOT receive escalated tickets automatically

This allows:
- Different Senior Admins for different hostels
- Different Senior Admins for different college departments
- Flexible escalation paths per category/location
- Committees to assist with specific issues without being in the escalation chain

---

## Important Notes

1. **Database is Single Source of Truth**: Roles are stored in the database (`user_roles` table), not in Clerk metadata. Clerk metadata is only used for lightweight checks in middleware.

2. **Security: Never Trust Clerk Metadata for Authorization**: Middleware may redirect based on Clerk metadata, but **all API routes and layouts MUST check role from the database, never from Clerk**. This prevents privilege escalation attacks from forged JWT metadata.

3. **Edge Runtime Limitations**: Middleware runs in Edge runtime and cannot access the database. It uses Clerk metadata for lightweight checks. Full authorization happens in layout files and API routes using `getUserRoleFromDB()`.

4. **Profile Completeness**: Students must complete their profile before accessing the dashboard. This check happens in `src/app/(app)/student/dashboard/layout.tsx`.

5. **Idempotent Operations**: `getOrCreateUser()` is idempotent - it can be called multiple times safely. It will create the user if missing, or return existing user if present.

6. **Webhook vs. Sync**: User creation happens via Clerk webhook (`user.created` event) OR via `getOrCreateUser()` if webhook hasn't fired yet. Both methods are safe and idempotent. If Clerk webhook fails or is delayed, `getOrCreateUser()` acts as a backup path, preventing "phantom session" issues where a user is authenticated but not in the DB.

7. **Graceful Fallback for Missing Roles**: If `user_roles` returns an empty list (e.g., during migrations or edge cases), the system defaults to "student" role. This improves reliability and prevents authorization failures.

8. **Domain/Scope-Aware Authorization**: Roles are global, but authority is domain- and scope-specific. A user can be `ADMIN` for Hostel (Neeladri) and `COMMITTEE` for College simultaneously. API routes should check roles with domain/scope context when needed.

9. **Escalation Chains are Configurable**: Escalation levels (Admin → Senior Admin → Super Admin) are determined per domain/scope via the `escalation_rules` table, not hardcoded. This allows different escalation paths for different categories/locations.

---

## Troubleshooting

### User Not Redirecting Correctly

1. Check if user exists in database: Query `users` table by `clerk_id`
2. Check if role is assigned: Query `user_roles` table for user's `user_id`
3. Check role priority: If user has multiple roles, highest priority is used

### Profile Not Completing

1. Check required fields: All fields must have values (not null or empty)
2. Check `students` table: Ensure record exists and is linked to `users.id`
3. Check Clerk metadata: `userNumber` must be set in Clerk `publicMetadata`

### Role Not Working

1. Verify role exists in `roles` table
2. Verify `user_roles` entry exists for user
3. Check role name matches exactly: "student", "admin", "senior_admin", "super_admin", "committee"
4. Verify role priority if user has multiple roles
5. Check domain/scope if role is scoped (e.g., Admin for Hostel Neeladri)
6. Verify API route is checking database role, not Clerk metadata

---

## Summary

The application uses a **database-first role system** where:

1. **Authentication** is handled by Clerk
2. **User records** are synced to database via webhook or `getOrCreateUser()`
3. **Roles** are stored in `user_roles` table (multi-role support)
4. **Authorization** happens in layout files and API routes using `getUserRoleFromDB()`
5. **Redirection** is based on highest priority role from database

This architecture ensures:
- ✅ Single source of truth (database)
- ✅ Multi-role support with priority-based dashboard redirection
- ✅ Scoped roles (domain/scope) for fine-grained permissions
- ✅ Flexible RBAC with configurable escalation chains
- ✅ Audit trail (who granted roles, when)
- ✅ Security: Database authorization prevents privilege escalation
- ✅ Resilience: Graceful fallbacks for webhook failures and missing roles

---

## Optional Enhancements (Future Improvements)

### A. Session Caching

**Current State**: Every homepage visit triggers 2-3 DB queries (`getOrCreateUser`, `getUserRoleFromDB`).

**Potential Optimization**:
- Redis session flags for role caching
- Clerk session `privateMetadata` caching
- DB row caching on first load

**Impact**: Reduces database load and improves response time for authenticated users.

### B. Permission Matrix

**Recommended**: Create a permission matrix table for each role:

| Permission | Student | Committee | Admin | Senior Admin | Super Admin |
|------------|---------|-----------|-------|--------------|-------------|
| Create ticket | ✅ | ✅ | ❌ | ❌ | ❌ |
| Acknowledge ticket | ❌ | ❌ | ✅ | ✅ | ✅ |
| Escalate ticket | ✅ | ❌ | ✅ | ✅ | ✅ |
| Close ticket | ❌ | ✅* | ✅ | ✅ | ✅ |
| Tag committees | ❌ | ❌ | ✅ | ✅ | ✅ |
| Manage staff | ❌ | ❌ | ❌ | ❌ | ✅ |
| View analytics | ❌ | ❌ | ✅ | ✅ | ✅ |
| Manage escalation rules | ❌ | ❌ | ❌ | ❌ | ✅ |
| Receive escalated tickets | ❌ | ❌** | ✅*** | ✅*** | ✅ |

*Committee can close tickets tagged to their committee (by admins)
**Committees do NOT receive escalated tickets - they only see tickets explicitly tagged to them
***Admin and Senior Admin receive escalated tickets based on escalation rules configured in `escalation_rules` table

**Implementation**: Use helper functions like `canPerformAction(userId, action, ticket?)` that checks role + domain/scope.

### C. Role-Scoped Navigation

**Current State**: Navigation shows all admin tools regardless of user's domain/scope.

**Potential Enhancement**: Show role-scoped navigation (e.g., Admin tools only for domains where user is staff).

**Example**:
- User is Admin (Hostel Neeladri) + Committee (Cultural)
- Dashboard shows: Hostel admin tools + Committee tools
- Hides: College admin tools, other hostel admin tools

**Implementation**: Filter navigation items based on `getUserRoles(userId)` with domain/scope context.

### D. Helper Functions

**Recommended**: Create helper functions for common authorization patterns:

```typescript
// Get all authorities who can handle a ticket
getAuthoritiesForTicket(ticketId: number): Promise<Authority[]>

// Check if user can perform action on ticket
canPerformAction(userId: string, action: string, ticketId: number): Promise<boolean>

// Get escalation chain for ticket
getEscalationChainForTicket(ticketId: number): Promise<EscalationLevel[]>
```

These helpers simplify authorization logic across the application and ensure consistency.

