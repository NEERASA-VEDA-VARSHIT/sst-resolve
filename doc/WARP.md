# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Tooling & Commands

This project is a Next.js 15 application using pnpm and Drizzle ORM with a Postgres database.

### Core app commands

- Install dependencies (root of repo):
  - `pnpm install`
- Run dev server (Next.js, Turbopack):
  - `pnpm dev`
- Build (also acts as a TypeScript check, see `MIGRATION_CHECKLIST.md`):
  - `pnpm build`
- Start production server (after build):
  - `pnpm start`
- Lint TypeScript/JavaScript with ESLint:
  - `pnpm lint`

### Database & Drizzle

Database connection is configured in `src/db/index.ts` via `process.env.DATABASE_URL` (Postgres, SSL required). Ensure this env var is set (typically via `.env.local` or your deployment environment).

Key scripts from `package.json`:

- Generate Drizzle SQL from schema:
  - `pnpm db:generate` (runs `drizzle-kit generate`)
- Apply Drizzle migrations:
  - `pnpm db:migrate`
- Push schema directly (where supported):
  - `pnpm db:push`
- Open Drizzle Studio:
  - `pnpm db:studio`
- Apply custom migration script (see `scripts/apply-migration.js`):
  - `pnpm db:apply-migration`
- Initialize core RBAC roles in the DB (see `src/db/schema.ts` & `src/lib/db-roles.ts`):
  - `pnpm db:init-roles`
- Seed master/category data (see `scripts/` directory):
  - `pnpm db:init-categories`
  - `pnpm db:init-hostel`
- Database maintenance helpers (each is a standalone script under `scripts/`):
  - `pnpm db:clean`
  - `pnpm db:clean-old-records`
  - `pnpm db:delete-all`
  - `pnpm db:make-super-admin`

### Ad-hoc scripts & "single test"-style checks

There is no central test runner; validations are mostly script-driven under `scripts/`.

Common patterns:

- Run an individual operational/check script:
  - `node scripts/test-master-apis.js`
  - `node scripts/test-redirects.js`
  - `node scripts/quick-api-test.js`
- Run email test script defined in `package.json`:
  - `pnpm test:email` (runs `node test-email.js`)

Refer to the `scripts/` directory for additional utilities such as migrations (`migrate.js`, `run-master-tables-migration.js`), data initialization (`init-roles.js`, `init-categories.js`, `init-hostel-categories.js`), debugging (`debug-api.js`, `check-ticket-comments.js`), and cleanup (`clean-database.js`, `clear-cache.js`). All are standard Node scripts invokable as `node scripts/<name>.js`.

## High-Level Architecture

### Framework & runtime

- Framework: Next.js 15 App Router, with the main entry at `src/app/page.tsx` and role-specific app routes under `src/app/(app)/...`.
- UI: React 19 with Radix UI, Tailwind CSS v4, and shadcn-style components in `src/components`.
- API routes live under `src/app/api/...` and share the same RBAC and user model as the page layer.

### Authentication & user lifecycle

Core files (see also `USER_FLOW_DOCUMENTATION.md`):

- `src/middleware.ts`
  - Uses `@clerk/nextjs`'s `clerkMiddleware` plus `createRouteMatcher` to classify routes:
    - Public: `/`, `/favicon.ico`, `/api/auth*`, `/api/slack*`.
    - Role-prefixed app routes: `/student(...)`, `/admin(...)`, `/superadmin(...)`, `/committee(...)`.
  - Runs in the Edge runtime; **intentionally avoids heavy DB work**. It:
    - Redirects unauthenticated users to `/` (except public routes).
    - For authenticated users, best-effort fetches a lightweight role via `getRoleFast(userId)`.
    - If the DB call fails (Edge/driver issues), it logs and allows the request through; page-level code is responsible for authoritative authorization.
    - Performs coarse routing based on the effective role (e.g., SuperAdmin → `/superadmin/dashboard` when hitting non-superadmin routes).

- `src/app/page.tsx`
  - Uses `auth()` from Clerk; unauthenticated users see `<LandingPage />`.
  - For authenticated users, it calls `getOrCreateUser(userId)` (see below) to ensure a DB user exists, then computes the canonical role via `getUserRoleFromDB(userId)`.
  - Uses `getDashboardPath(role)` from `src/types/auth.ts` to redirect to the appropriate dashboard (`/student/dashboard`, `/admin/dashboard`, `/superadmin/dashboard`, `/committee/dashboard`).

- `src/lib/user-sync.ts`
  - Centralizes synchronization between Clerk users and the `users` table.
  - `syncUserFromClerk(clerkUserId)`:
    - Fetches the user from Clerk, normalizes primary email/phone/display name.
    - **Security constraint:** only syncs by `clerk_id` (never by email) to prevent account hijacking.
    - Creates new DB users with default `"student"` role and logs all errors; role elevation is handled elsewhere via backend APIs.
  - `getOrCreateUser(clerkUserId)`:
    - First attempts to find the user by `clerk_id`.
    - If missing, implements **auto-linking** for CSV-imported students: when a `users.email` matches the Clerk primary email and `clerk_id` has a `pending_...` value, it atomically updates that record to bind the real Clerk ID, ensuring race-safety and preserving role assignments.
    - After auto-linking, it invalidates the in-memory role cache (see `db-roles.ts`) for both the old and new `clerk_id`.

- `src/app/(app)/student/dashboard/layout.tsx`
  - Node runtime layout that runs after Edge middleware.
  - Enforces two invariants for student pages:
    - User must be authenticated (redirect to `/` otherwise).
    - Student profile must be complete (`isProfileComplete(userId)` from `src/lib/profile-check.ts`); if not, redirect to `/student/profile`.

### Role system & authorization model

Core pieces:

- `src/types/auth.ts`
  - Defines the `UserRole` union: `"super_admin" | "senior_admin" | "admin" | "committee" | "student"`.
  - Exposes `getDashboardPath(role)` which maps roles to dashboard routes (e.g., `senior_admin` shares the admin dashboard).

- `src/db/schema.ts` (roles and user_roles)
  - `roles` table: canonical role definitions (name, description) with an index on `name`.
  - `user_roles` table: join table providing multi-role support plus optional `domain` and `scope` fields for scoping roles (e.g., specific hostel/department). Enforces uniqueness `(user_id, role_id, domain, scope)`.

- `src/lib/db-roles.ts`
  - Single source of truth for role resolution and mutation; **database is authoritative**, not Clerk metadata.
  - Exposes:
    - `getUserRoleFromDB(clerkUserId)` – computes the **primary role** from `user_roles` using a priority map (`super_admin` > `senior_admin` > `admin` > `committee` > `student`).
      - Uses a short-lived in-memory cache keyed by `clerkUserId`.
      - **Important security behavior:** cached values are trusted only when the role is `student` (lowest privilege); elevated roles always re-hit the DB to avoid stale privilege escalation.
      - Defaults to `student` if the user or roles are missing (with dev-time warnings).
    - `getUserRoles(clerkUserId)` – returns all roles plus their `domain` and `scope` details for advanced UIs/APIs.
    - `setUserRole(...)` / `removeUserRole(...)` – manage `user_roles` entries, including optional `domain`/`scope`, and invalidate the user role cache on changes.
    - `userHasRole(...)` – read-only check that never creates roles; uses `getRoleId` internally.
    - `getOrCreateRole` / `getRoleId` – helpers for role existence with in-memory caching and race-condition-safe insertion.
    - `invalidateUserRoleCache(clerkUserId)` – exported utility used by `user-sync.ts` and other modules to force re-evaluation after key events (e.g., auto-linking).

When adding new privileged behavior, always use `getUserRoleFromDB` / `userHasRole` or the scoped `getUserRoles` rather than any Clerk metadata.

### Data model highlights

Defined in `src/db/schema.ts` and referenced throughout the app:

- `users` – canonical identity records synchronized from Clerk (`clerk_id`, `email`, `name`, `phone`).
- `students` – student-specific data linked to `users` via `user_id`, including `roll_no`, `room_no`, and references to master tables:
  - `hostel_id` → `hostels`
  - `class_section_id` → `class_sections`
  - `batch_id` → `batches`
  - Also tracks status fields (`active`, ticket rate-limiting counters, `source`, `last_synced_at`).
- Master data tables:
  - `hostels` – admin-controlled hostels with `is_active` flags.
  - `batches` – graduation year master data with active flags.
  - `class_sections` – dynamic section names (e.g., `A`, `AI-1`, `DataSci-A`).
- `student_profile_fields` – metadata-driven configuration for profile fields (name, label, type, required/editable flags, validation rules JSON, order, default, help text). SuperAdmin controls these definitions.
- Staff & escalation:
  - `staff` – admin/committee/etc. staff metadata linked to `users` via `user_id`, with `domain`/`scope` used alongside `user_roles`.
  - `escalation_rules` – ordered chain of escalation targets per `(domain, scope)` used by the ticketing system.
- Tickets (and related tables) are also defined in `schema.ts` beyond the snippet; they rely on the role and staff structures above for routing and escalation.

### Student master data & CSV profile system

See `MIGRATION_CHECKLIST.md` and `MASTER_TABLES_MIGRATION.md` for full details; at a high level:

- Legacy enums for hostel/class were removed; all such data is now driven by master tables (`hostels`, `batches`, `class_sections`).
- Student profiles are managed via:
  - SuperAdmin UI at `src/app/(app)/superadmin/students/page.tsx` (client-side page using `StudentBulkUpload` component and a paginated table with filters for hostel and batch year).
  - CSV-based bulk upload API at `src/app/api/superadmin/students/bulk-upload/route.ts` (referenced in `MIGRATION_CHECKLIST.md`).
  - Supporting routes: `/api/superadmin/students/template` (CSV template) and `/api/superadmin/students` (listing/search/filter endpoint with master-table joins).
- The bulk upload path:
  - Preloads master data into an in-memory cache (see `MASTER_TABLES_MIGRATION.md`) so that CSV rows can be validated and mapped to FK IDs without N+1 queries.
  - Validates hostel, batch, and section columns against active master records, returning detailed error messages with valid options when mismatches occur.
  - Inserts students using FK IDs (`hostel_id`, `batch_id`, `class_section_id`) rather than raw strings.
- Auto-linking combines this CSV path with `getOrCreateUser` in `user-sync.ts` so that when a student later signs into Clerk with an email that exists in the CSV import, their Clerk account is attached to the pre-existing student record.

### User flow by role (summary)

`USER_FLOW_DOCUMENTATION.md` provides a detailed narrative; core points for future changes:

- Entry path is always `/`:
  - Middleware performs a lightweight auth/role classification but defers authoritative decisions to page/layout code.
  - `src/app/page.tsx` is responsible for syncing the user, loading the DB role, and redirecting.
- Students:
  - New students are created via Clerk webhook and/or `getOrCreateUser` backup path.
  - First-time or incomplete profiles are redirected to `/student/profile` (checked in the student layout).
  - Existing students go directly to `/student/dashboard` once profile completeness is satisfied.
- Admin / Senior Admin / Super Admin / Committee:
  - All share the same underlying role system (`user_roles` + `roles`).
  - Middleware steers them towards `/admin/dashboard`, `/superadmin/dashboard`, or `/committee/dashboard` based on the primary role.
  - Page-level code must still enforce authorization, especially for API routes and sensitive operations.

### Operational scripts & migrations

The `scripts/` directory contains operational tooling that is frequently referenced in the markdown docs:

- Migration helpers: `migrate.js`, `migrate-auto.js`, `run-master-tables-migration.js`, `verify-migration.js`, `apply-migration.js`.
- Initialization: `init-roles.js`, `ensure-default-roles.js`, `init-categories.js`, `init-hostel-categories.js`, `make-super-admin.js`, `add-missing-columns.js`, `apply-admin-assignment-migration.js`.
- Maintenance & cleanup: `clean-database.js`, `clean-old-records.js`, `cleanup-old-columns.js`, `delete-all-records.js`, `clear-cache.js`, `clear-tickets.js`.
- Diagnostics / checks: `check-columns.js`, `check-ticket-comments.js`, `check-user-role.js`, `test-master-apis.js`, `test-db-roles-fixes.js`, `test-redirects.js`, `quick-api-test.js`, `debug-api.js`, `warmup-routes.js`.

All of these are entry-point Node scripts and can be invoked directly with `node scripts/<script>.js` (or wrapped via new `package.json` scripts if needed). Consult `MIGRATION_CHECKLIST.md`, `MASTER_TABLES_MIGRATION.md`, and inline script comments before running destructive operations.
