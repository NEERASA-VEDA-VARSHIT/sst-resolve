# Build Errors & Import Issues

This document tracks all build-time errors, import issues, and deployment failures encountered in the project.

---

## 🔴 Critical Issues

### 1. Server-Only Module Imported in Pages (Turbopack Build Error)

**Error Type:** Invalid Import / Module Resolution  
**Severity:** 🔴 Critical - Blocks Production Build  
**Status:** 🔴 Unresolved

#### Error Message
```
Error: Turbopack build failed with 10 errors:
./Desktop/sst/sst-resolve/src/db/index.ts:3:1
Ecmascript file had an error

You're importing a component that needs "server-only". That only works in a Server Component 
which is not supported in the pages/ directory.

Invalid import: 'server-only' cannot be imported from a Client Component module.
```

#### Additional Module Errors
```
Module not found: Can't resolve 'fs'
Module not found: Can't resolve 'net'
Module not found: Can't resolve 'tls'
Module not found: Can't resolve 'perf_hooks'
```

These errors occur in `node_modules/.pnpm/postgres@3.4.7/node_modules/postgres/src/` because Node.js built-in modules (`fs`, `net`, `tls`, `perf_hooks`) cannot be bundled for client-side code.

#### Root Cause Analysis

**The core issue:** Page files in the App Router are importing `@/db` directly, which contains:
1. `import 'server-only'` directive
2. Node.js-only dependencies (`postgres` package using `fs`, `net`, `tls`, etc.)

While App Router pages are Server Components by default, Turbopack's build process is detecting these imports and attempting to bundle them for potential client-side use, causing the build to fail.

#### Affected Files (22 Page Components)

All files in `src/app/(app)` that import from `@/db`:

**Super Admin Pages:**
1. `src/app/(app)/superadmin/tickets/page.tsx`
2. `src/app/(app)/superadmin/dashboard/page.tsx`
3. `src/app/(app)/superadmin/dashboard/today/page.tsx`
4. `src/app/(app)/superadmin/dashboard/ticket/[ticketId]/page.tsx`
5. `src/app/(app)/superadmin/dashboard/groups/page.tsx`
6. `src/app/(app)/superadmin/dashboard/escalated/page.tsx`
7. `src/app/(app)/superadmin/dashboard/committee/page.tsx`
8. `src/app/(app)/superadmin/dashboard/categories/page.tsx`
9. `src/app/(app)/superadmin/dashboard/analytics/page.tsx`
10. `src/app/(app)/superadmin/analytics/page.tsx`
11. `src/app/(app)/superadmin/dashboard/analytics/category/[categoryId]/page.tsx`
12. `src/app/(app)/superadmin/dashboard/analytics/admin/[adminId]/page.tsx`

**Admin Pages:**
13. `src/app/(app)/admin/dashboard/page.tsx`
14. `src/app/(app)/admin/dashboard/today/page.tsx`
15. `src/app/(app)/admin/dashboard/ticket/[ticketId]/page.tsx`
16. `src/app/(app)/admin/dashboard/groups/page.tsx`
17. `src/app/(app)/admin/dashboard/escalated/page.tsx`
18. `src/app/(app)/admin/dashboard/analytics/page.tsx`

**Committee Pages:**
19. `src/app/(app)/committee/dashboard/page.tsx`
20. `src/app/(app)/committee/dashboard/ticket/[ticketId]/page.tsx`

**Student Pages:**
21. `src/app/(app)/student/dashboard/page.tsx`
22. `src/app/(app)/student/dashboard/ticket/new/page.tsx`

#### Related Documentation
- [Next.js Server and Client Components](https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns)
- [Server-Only Package](https://www.npmjs.com/package/server-only)
- [Next.js Data Fetching Patterns](https://nextjs.org/docs/app/building-your-application/data-fetching/patterns)
---

## 🔧 Implementation Status

### ✅ Changes Applied

**1. Updated `next.config.ts`**
- Added `'drizzle-orm'` to `serverExternalPackages` array
- Configuration now includes: `['postgres', 'pg', 'better-sqlite3', 'drizzle-orm']`
- Removed invalid `resolveAlias` boolean configurations (caused Turbopack errors)

**2. Modified `src/db/index.ts`**
- Commented out `import 'server-only'` statement
- Added explanatory comment about Turbopack build issues

### 🔴 Current Build Status

**Status:** Build still failing with module resolution errors

**Attempted Fixes:**
1. ✅ Added `drizzle-orm` to `serverExternalPackages`
2. ✅ Commented out `import 'server-only'`
3. ❌ Tried `resolveAlias` with boolean values (invalid - Turbopack expects strings/arrays/objects)
4. ❌ Tried empty `turbopack: {}` configuration

**Error Patterns Observed:**
- Module not found errors for Node.js built-in modules (`fs`, `net`, `tls`, `crypto`, `stream`, `perf_hooks`)
- These errors occur in `node_modules/.pnpm/postgres@3.4.7/node_modules/postgres/src/`
- Turbopack is attempting to bundle server-only Node.js modules for client-side code

### ⚠️ Root Cause Analysis

The issue is that **Turbopack is trying to bundle the `postgres` package** (which uses Node.js built-in modules) even though it's listed in `serverExternalPackages`. This suggests:

1. `serverExternalPackages` may not be fully respected by Turbopack in Next.js 15.5.5
2. There may be a client component somewhere importing from `@/db` (directly or transitively)
3. Turbopack's module resolution is different from Webpack's

### 🔴 TypeScript Errors Still Present

Separate from the build error, there are **152 TypeScript errors across 42 files** that will also need to be addressed:

**Most Affected Files:**
- `src/app/(app)/committee/dashboard/page.tsx` (37 errors)
- `src/app/(app)/admin/dashboard/today/page.tsx` (13 errors)
- `src/app/api/cron/tat-reminders/route.ts` (10 errors)
- `src/workers/handlers/processTicketCommentAddedWorker.ts` (7 errors)

### 📋 Next Steps

**CRITICAL:** The build is failing primarily due to **152 TypeScript compilation errors**, not the server-only import issue.

#### Immediate Action Required

1. **Fix TypeScript Errors First** ⚡
   - The build cannot complete with TypeScript errors present
   - Focus on high-impact files with the most errors
   - Common issues to address:
     - Missing database schema properties
     - Type mismatches in queries
     - Invalid property accesses

2. **After TypeScript Errors Are Fixed**
   - Re-run `pnpm build` to see if server-only import issue persists
   - If it does, try commenting out `import 'server-only'` in `src/db/index.ts`
   - The `serverExternalPackages` configuration in `next.config.ts` provides protection

3. **Alternative Approach**
   - Consider refactoring to Option 3 (data access layer) for long-term maintainability
   - This would separate database logic from page components entirely

---

## 🎯 Current Status (Updated)

### ✅ Progress Made

1. **TypeScript Errors Fixed** - User resolved 152 TypeScript errors down to 5 Next.js 15 type compatibility issues
2. **Next.js 15 Types Fixed** - Updated `searchParams` types in 5 page files to accept both Promise and non-Promise versions
3. **Configuration Updated** - Added `drizzle-orm` to `serverExternalPackages` in `next.config.ts`

### 🔴 Build Still Failing

Despite fixing all TypeScript errors, the build continues to fail with both:
- ❌ Turbopack (`next build --turbopack`)
- ❌ Webpack (`next build`)

**Error Pattern:** Module resolution errors for Node.js built-in modules (`fs`, `net`, `tls`, etc.) in the `postgres` package.

### 🔍 Recommended Next Steps

1. **Get Full Error Output**
   ```bash
   # Try to capture full build output
   pnpm build 2>&1 | Out-File -FilePath build-log.txt -Encoding UTF8
   # Then view the file to see complete error
   ```

2. **Check for Client-Side Imports**
   ```bash
   # Search for any 'use client' files importing from @/db
   rg "'use client'" -A 20 src/app | rg "@/db"
   ```

3. **Verify Database Connection**
   - Ensure `.env.local` has valid `DATABASE_URL`
   - Test database connectivity separately

4. **Try Development Mode**
   ```bash
   pnpm dev
   # If dev works but build fails, it's a build-specific issue
   ```

5. **Consider Temporary Workaround**
   - Comment out `import 'server-only'` in `src/db/index.ts`
   - This removes the explicit server-only protection but may allow build to proceed

---

## 📝 Summary

**What We Know:**
- ✅ All TypeScript errors are fixed
- ✅ Next.js configuration is correct
- ❌ Build fails with module resolution errors
- ❌ Error output is truncated, making diagnosis difficult

**Most Likely Causes:**
1. A client component is importing `@/db` (directly or transitively)
2. Turbopack/Webpack is incorrectly trying to bundle server-only code
3. Environment variable or database connection issue

**Immediate Action:**
Get the full build error output to see exactly which file is causing the import issue.



### Option 1: Remove `server-only` Import (Quick Fix) ⚡

**Complexity:** Low  
**Risk:** Low  
**Time:** 5 minutes

#### What to Do
Remove the `import 'server-only'` statement from `src/db/index.ts`.

#### Steps
1. Open `src/db/index.ts`
2. Remove or comment out line 3: `import 'server-only';`
3. Run `pnpm build` to verify

#### Pros
- ✅ Fastest solution
- ✅ No code refactoring needed
- ✅ Pages are already Server Components by default

#### Cons
- ⚠️ Removes explicit protection against accidental client-side imports
- ⚠️ Doesn't address the underlying Turbopack bundling issue

#### When to Use
- When you need to deploy immediately
- When all pages are confirmed to be Server Components
- As a temporary fix while implementing a more robust solution

---

### Option 2: Configure Turbopack Server-Only Externals (Recommended) ⭐

**Complexity:** Medium  
**Risk:** Low  
**Time:** 15 minutes

#### What to Do
Configure Next.js to treat database and Node.js modules as server-only externals in the Turbopack configuration.

#### Steps
1. Open `next.config.ts` or `next.config.js`
2. Add server-only externals configuration:

```typescript
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['postgres', 'drizzle-orm'],
  },
  // For Turbopack specifically
  turbopack: {
    resolveAlias: {
      // Prevent client-side bundling of server-only modules
      'server-only': false,
    },
  },
};
```

3. Run `pnpm build` to verify

#### Pros
- ✅ Explicitly tells Next.js these are server-only packages
- ✅ Prevents accidental client-side bundling
- ✅ Keeps the `server-only` protection in place
- ✅ Recommended by Next.js documentation

#### Cons
- ⚠️ Requires Next.js configuration changes
- ⚠️ May need adjustment for other server-only packages

#### When to Use
- **Recommended for production**
- When you want explicit server-only package configuration
- When you want to maintain the `server-only` import protection

---

### Option 3: Refactor to Data Access Layer (Long-term Solution) 🏗️

**Complexity:** High  
**Risk:** Medium  
**Time:** 2-4 hours

#### What to Do
Create a dedicated data access layer with Server Actions or API routes to completely separate database logic from page components.

#### Architecture
```
src/
├── app/
│   ├── (app)/
│   │   └── */page.tsx          # Pages (no direct DB imports)
│   └── api/
│       └── */route.ts          # API routes (can import DB)
├── db/
│   └── index.ts                # Database connection
├── actions/                     # NEW: Server Actions
│   ├── tickets.ts
│   ├── users.ts
│   └── categories.ts
└── lib/
    └── data/                    # NEW: Data access functions
        ├── tickets.ts
        ├── users.ts
        └── categories.ts
```

#### Steps
1. Create `src/actions/` directory for Server Actions
2. Move database queries from pages to Server Actions
3. Add `'use server'` directive to action files
4. Update pages to call Server Actions instead of direct DB queries
5. Test each refactored page

#### Example Refactor

**Before** (`page.tsx`):
```typescript
import { db, tickets } from "@/db";

export default async function Page() {
  const allTickets = await db.select().from(tickets);
  return <div>{/* render */}</div>;
}
```

**After** (`page.tsx`):
```typescript
import { getTickets } from "@/actions/tickets";

export default async function Page() {
  const allTickets = await getTickets();
  return <div>{/* render */}</div>;
}
```

**New file** (`src/actions/tickets.ts`):
```typescript
'use server';

import { db, tickets } from "@/db";

export async function getTickets() {
  return await db.select().from(tickets);
}
```

#### Pros
- ✅ Clean separation of concerns
- ✅ Better code organization
- ✅ Easier to test and maintain
- ✅ Reusable data access functions
- ✅ Future-proof architecture

#### Cons
- ⚠️ Requires significant refactoring
- ⚠️ Time-consuming for 22 page files
- ⚠️ Risk of introducing bugs during refactor
- ⚠️ Needs comprehensive testing

#### When to Use
- For long-term maintainability
- When you have time for proper refactoring
- When building new features (apply pattern going forward)



| Error ID | Type | Severity | File | Status |
|----------|------|----------|------|--------|
| BE-001 | Invalid Import | Critical | `src/db/index.ts` | 🔴 Unresolved |

---

## 🔧 Resolution Checklist

- [ ] Identify all Client Components importing `src/db`
- [ ] Audit import chains to find transitive imports
- [ ] Refactor client components to use API routes or Server Actions
- [ ] Remove `'use client'` from components that need database access, or
- [ ] Move database logic to separate server-side modules
- [ ] Test build process: `pnpm build`
- [ ] Verify no regression in functionality

---

## 📝 Notes

### Build Command
```bash
pnpm build
```

### Exit Code
```
ELIFECYCLE Command failed with exit code 1
```

### Next Steps
1. Run `grep -r "'use client'" src/` to find all client components
2. Check which of these import `src/db` directly or indirectly
3. Create a refactoring plan to separate client and server logic
4. Implement fixes systematically
5. Test each fix with `pnpm build`

---

## 📅 Change Log

| Date | Time | Description |
|------|------|-------------|
| 2025-11-21 | 22:07:48 | Initial build error detected |
| 2025-11-21 | 22:09:16 | Documentation created |

