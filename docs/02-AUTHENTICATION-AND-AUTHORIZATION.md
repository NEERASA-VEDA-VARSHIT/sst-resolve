# Authentication and Authorization

## Overview

SST-Resolve uses **Clerk** for authentication and implements a sophisticated role-based access control (RBAC) system with domain/scope restrictions.

## Technology Stack

### Core Authentication
- **Clerk** (`@clerk/nextjs`) - Authentication provider
- **Next.js Middleware** - Route protection
- **Server Actions** - Secure server-side operations

### Authorization
- **Custom RBAC** - Role-based access control
- **Drizzle ORM** - Database queries for permissions
- **PostgreSQL** - User and role storage

## Authentication Flow

### 1. User Sign-In (Clerk)

```typescript
// Clerk handles the entire auth flow
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }
  // User is authenticated
}
```

**Technologies Used:**
- Clerk SDK for Next.js
- Server-side authentication check
- Automatic session management

### 2. User Synchronization

**File**: `src/lib/user-sync.ts`

```typescript
export async function getOrCreateUser(clerkUserId: string) {
  // Check if user exists in our database
  let user = await db.query.users.findFirst({
    where: eq(users.clerk_id, clerkUserId)
  });

  if (!user) {
    // Fetch from Clerk
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    
    // Create in our database
    [user] = await db.insert(users).values({
      clerk_id: clerkUserId,
      email: clerkUser.emailAddresses[0].emailAddress,
      name: `${clerkUser.firstName} ${clerkUser.lastName}`,
    }).returning();
  }

  return user;
}
```

**Technologies Used:**
- Drizzle ORM for database operations
- Clerk Client SDK for user data
- PostgreSQL for user storage

**Why This Pattern:**
- Clerk manages authentication
- Our database stores application-specific data
- Sync happens on-demand (lazy loading)

### 3. Role Determination

**File**: `src/lib/db-roles.ts`

```typescript
export async function getUserRoleFromDB(clerkUserId: string): Promise<UserRole> {
  const user = await getOrCreateUser(clerkUserId);
  
  // Check if user is a student
  const student = await db.query.students.findFirst({
    where: eq(students.user_id, user.id)
  });
  if (student) return "student";

  // Check if user is staff
  const staffMember = await db.query.staff.findFirst({
    where: eq(staff.user_id, user.id)
  });
  
  if (staffMember) {
    // Determine admin level based on user_roles
    const roles = await db.query.user_roles.findMany({
      where: eq(user_roles.user_id, user.id),
      with: { role: true }
    });
    
    // Priority: super_admin > senior_admin > admin
    if (roles.some(r => r.role.name === "super_admin")) return "super_admin";
    if (roles.some(r => r.role.name === "senior_admin")) return "senior_admin";
    return "admin";
  }

  return "student"; // Default fallback
}
```

**Technologies Used:**
- Drizzle ORM with relations
- PostgreSQL joins
- Type-safe role enum

**Role Hierarchy:**
1. **student** - Basic user
2. **admin** - Domain-specific access
3. **senior_admin** - Multi-domain access
4. **super_admin** - Full system access
5. **committee** - Read-only oversight

## Authorization Patterns

### 1. Route Protection (Middleware)

**File**: `src/middleware.ts`

```typescript
import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: ["/", "/sign-in", "/sign-up"],
  ignoredRoutes: ["/api/webhooks/(.*)"],
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
```

**Technologies Used:**
- Clerk Middleware
- Next.js Middleware API
- Route pattern matching

**How It Works:**
- All routes protected by default
- Public routes explicitly allowed
- Webhooks ignored (have their own auth)

### 2. API Route Authorization

**Pattern 1: Role-Based**

```typescript
// File: src/app/api/admin/tickets/route.ts
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getUserRoleFromDB(userId);
  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Admin-only logic
}
```

**Pattern 2: Domain/Scope-Based**

```typescript
// File: src/app/api/tickets/route.ts
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  const user = await getOrCreateUser(userId);
  const role = await getUserRoleFromDB(userId);

  let query = db.select().from(tickets);

  if (role === "student") {
    // Students see only their tickets
    query = query.where(eq(tickets.created_by, user.id));
  } else if (role === "admin") {
    // Admins see tickets in their domain/scope
    const staffMember = await db.query.staff.findFirst({
      where: eq(staff.user_id, user.id)
    });
    query = query.where(eq(tickets.assigned_to, staffMember.id));
  }
  // super_admin sees all tickets (no filter)

  const results = await query;
  return NextResponse.json({ tickets: results });
}
```

**Technologies Used:**
- Next.js API Routes
- Drizzle ORM conditional queries
- PostgreSQL row-level filtering

### 3. Client-Side Authorization

**Pattern: Conditional Rendering**

```typescript
// File: src/components/tickets/AdminActions.tsx
"use client";

export function AdminActions({ ticket, isSuperAdmin }: Props) {
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    async function fetchRole() {
      const response = await fetch("/api/auth/role");
      const data = await response.json();
      setRole(data.role);
    }
    fetchRole();
  }, []);

  return (
    <div>
      {/* All admins can comment */}
      <Button onClick={handleComment}>Add Comment</Button>

      {/* Only super admins can delete */}
      {isSuperAdmin && (
        <Button onClick={handleDelete} variant="destructive">
          Delete Ticket
        </Button>
      )}

      {/* Admins can reassign */}
      {(role === "admin" || role === "super_admin") && (
        <Button onClick={handleReassign}>Reassign</Button>
      )}
    </div>
  );
}
```

**Technologies Used:**
- React hooks (`useState`, `useEffect`)
- Client-side API calls
- Conditional rendering

## Database Schema

### Users Table

```typescript
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerk_id: varchar("clerk_id", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 256 }).notNull().unique(),
  name: varchar("name", { length: 120 }),
  phone: varchar("phone", { length: 30 }),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});
```

**Key Points:**
- `clerk_id` links to Clerk's user ID
- `id` is our internal UUID
- Email is unique and required

### Roles Table

```typescript
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  description: text("description"),
  created_at: timestamp("created_at").defaultNow(),
});
```

**Predefined Roles:**
- `student`
- `admin`
- `senior_admin`
- `super_admin`
- `committee`

### User Roles (Many-to-Many)

```typescript
export const user_roles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  user_id: uuid("user_id").references(() => users.id).notNull(),
  role_id: integer("role_id").references(() => roles.id).notNull(),
  domain: varchar("domain", { length: 64 }), // "Hostel", "College"
  scope: varchar("scope", { length: 128 }), // "Neeladri", "Velankani"
  granted_by: uuid("granted_by").references(() => users.id),
  created_at: timestamp("created_at").defaultNow(),
});
```

**Key Features:**
- Multi-role support (user can have multiple roles)
- Domain/scope restrictions
- Audit trail (granted_by)

### Staff Table

```typescript
export const staff = pgTable("staff", {
  id: serial("id").primaryKey(),
  user_id: uuid("user_id").references(() => users.id).notNull().unique(),
  full_name: varchar("full_name", { length: 120 }).notNull(),
  domain: varchar("domain", { length: 64 }), // "Hostel", "College"
  scope: varchar("scope", { length: 128 }), // Specific hostel/department
  created_at: timestamp("created_at").defaultNow(),
});
```

**Purpose:**
- Links users to staff records
- Defines admin's area of responsibility
- Used for ticket assignment

## Security Best Practices

### 1. Never Trust Client Input

```typescript
// ❌ BAD - Trusting client-sent role
export async function POST(request: NextRequest) {
  const { role } = await request.json();
  if (role === "admin") {
    // DANGEROUS! Client can fake this
  }
}

// ✅ GOOD - Always verify server-side
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  const role = await getUserRoleFromDB(userId); // Server-side lookup
  if (role === "admin") {
    // Safe!
  }
}
```

### 2. Validate Permissions at Every Layer

```
Request → Middleware (Clerk) → API Route (Role Check) → Database (Row Filter)
```

**Example:**
```typescript
// Layer 1: Middleware ensures user is authenticated
// Layer 2: API route checks role
const role = await getUserRoleFromDB(userId);
if (role !== "super_admin") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// Layer 3: Database query filters by permission
const students = await db.query.students.findMany({
  where: and(
    eq(students.active, true),
    // Additional filters based on role
  )
});
```

### 3. Use TypeScript for Type Safety

```typescript
export type UserRole = "student" | "admin" | "senior_admin" | "super_admin" | "committee";

// Compile-time safety
function checkPermission(role: UserRole) {
  // TypeScript ensures only valid roles
}
```

## Common Patterns

### Pattern 1: Protected API Route

```typescript
export async function POST(request: NextRequest) {
  // 1. Authenticate
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2. Get user and role
  const user = await getOrCreateUser(userId);
  const role = await getUserRoleFromDB(userId);

  // 3. Authorize
  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 4. Perform action
  // ...
}
```

### Pattern 2: Domain-Scoped Query

```typescript
async function getTicketsForUser(userId: string) {
  const user = await getOrCreateUser(userId);
  const role = await getUserRoleFromDB(userId);

  if (role === "student") {
    return db.query.tickets.findMany({
      where: eq(tickets.created_by, user.id)
    });
  }

  if (role === "admin") {
    const staffMember = await db.query.staff.findFirst({
      where: eq(staff.user_id, user.id)
    });
    return db.query.tickets.findMany({
      where: eq(tickets.assigned_to, staffMember.id)
    });
  }

  // super_admin gets all
  return db.query.tickets.findMany();
}
```

### Pattern 3: Client-Side Role Check

```typescript
"use client";

export function useUserRole() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRole() {
      try {
        const response = await fetch("/api/auth/role");
        const data = await response.json();
        setRole(data.role);
      } catch (error) {
        console.error("Failed to fetch role:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchRole();
  }, []);

  return { role, loading };
}

// Usage
function MyComponent() {
  const { role, loading } = useUserRole();

  if (loading) return <Skeleton />;

  return (
    <div>
      {role === "super_admin" && <AdminPanel />}
      {role === "student" && <StudentDashboard />}
    </div>
  );
}
```

## Summary

### Technologies Used:
- ✅ **Clerk** - Authentication provider
- ✅ **Next.js Middleware** - Route protection
- ✅ **Drizzle ORM** - Database queries
- ✅ **PostgreSQL** - Data storage
- ✅ **TypeScript** - Type safety
- ✅ **React Hooks** - Client-side state

### Key Concepts:
- **Authentication** - Who you are (Clerk)
- **Authorization** - What you can do (Custom RBAC)
- **Domain/Scope** - Where you can operate
- **Multi-layer Security** - Defense in depth
- **Type Safety** - Compile-time checks

### Best Practices:
- Always verify server-side
- Never trust client input
- Use TypeScript for safety
- Validate at every layer
- Audit all permission changes
