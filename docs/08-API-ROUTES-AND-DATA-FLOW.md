# API Routes and Data Flow

## Overview

SST-Resolve uses Next.js App Router API routes for backend functionality. All routes follow RESTful conventions with proper authentication, authorization, and validation.

## Technology Stack

### API Framework
- **Next.js 14 App Router** - API routes
- **Edge Runtime** - Fast responses
- **Server Actions** - Form mutations

### Validation
- **Zod** - Schema validation
- **TypeScript** - Type safety

### Authentication
- **Clerk** - Auth provider
- **Custom middleware** - Authorization

## API Route Structure

### File-Based Routing

```
src/app/api/
├── tickets/
│   ├── route.ts              # GET /api/tickets, POST /api/tickets
│   └── [id]/
│       ├── route.ts          # GET /api/tickets/[id], PATCH, DELETE
│       ├── status/route.ts   # PATCH /api/tickets/[id]/status
│       ├── escalate/route.ts # POST /api/tickets/[id]/escalate
│       └── forward/route.ts  # POST /api/tickets/[id]/forward
├── admin/
│   └── tickets/route.ts      # GET /api/admin/tickets
└── superadmin/
    └── students/
        ├── route.ts          # GET, POST /api/superadmin/students
        ├── [id]/route.ts     # GET, PATCH, DELETE
        └── bulk-edit/route.ts # PATCH bulk operations
```

## Standard API Pattern

### GET Request

```typescript
// File: src/app/api/tickets/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tickets } from "@/db/schema";

export async function GET(request: NextRequest) {
  try {
    // 1. Authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Get user and role
    const user = await getOrCreateUser(userId);
    const role = await getUserRoleFromDB(userId);

    // 3. Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    // 4. Build query with authorization
    let query = db.query.tickets.findMany({
      limit,
      offset: (page - 1) * limit,
      orderBy: desc(tickets.created_at),
    });

    // Apply role-based filtering
    if (role === "student") {
      query = query.where(eq(tickets.created_by, user.id));
    } else if (role === "admin") {
      const staff = await db.query.staff.findFirst({
        where: eq(staff.user_id, user.id),
      });
      query = query.where(eq(tickets.assigned_to, staff.id));
    }

    // Apply filters
    if (status) {
      query = query.where(eq(tickets.status, status));
    }

    // 5. Execute query
    const results = await query;

    // 6. Return response
    return NextResponse.json({
      tickets: results,
      pagination: {
        page,
        limit,
        total: results.length,
      },
    });
  } catch (error) {
    console.error("Error fetching tickets:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

### POST Request

```typescript
// File: src/app/api/tickets/route.ts
import { z } from "zod";

const CreateTicketSchema = z.object({
  title: z.string().min(5).max(255),
  description: z.string().min(10).max(5000),
  category_id: z.number(),
  metadata: z.record(z.any()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get user
    const user = await getOrCreateUser(userId);

    // 3. Parse and validate body
    const body = await request.json();
    const parsed = CreateTicketSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // 4. Business logic
    const category = await db.query.categories.findFirst({
      where: eq(categories.id, data.category_id),
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // 5. Create resource
    const [ticket] = await db.insert(tickets).values({
      title: data.title,
      description: data.description,
      category_id: data.category_id,
      created_by: user.id,
      status: "OPEN",
      metadata: data.metadata,
    }).returning();

    // 6. Return created resource
    return NextResponse.json(
      { ticket },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating ticket:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

### PATCH Request

```typescript
// File: src/app/api/tickets/[id]/route.ts
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    const role = await getUserRoleFromDB(userId);

    // Authorization check
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const ticketId = parseInt(id);

    const body = await request.json();
    const parsed = UpdateTicketSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input" },
        { status: 400 }
      );
    }

    // Update resource
    const [updated] = await db.update(tickets)
      .set({
        ...parsed.data,
        updated_at: new Date(),
      })
      .where(eq(tickets.id, ticketId))
      .returning();

    return NextResponse.json({ ticket: updated });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

## Data Flow Patterns

### Client → API → Database

```
1. User clicks "Create Ticket"
   ↓
2. Form validates with Zod (client-side)
   ↓
3. POST /api/tickets with form data
   ↓
4. API authenticates with Clerk
   ↓
5. API validates with Zod (server-side)
   ↓
6. API queries database with Drizzle
   ↓
7. Database returns created ticket
   ↓
8. API returns JSON response
   ↓
9. Client updates UI optimistically
```

### Server Component Data Fetching

```typescript
// File: src/app/(app)/student/dashboard/page.tsx
export default async function StudentDashboard() {
  // Server-side data fetching
  const { userId } = await auth();
  const user = await getOrCreateUser(userId);

  const tickets = await db.query.tickets.findMany({
    where: eq(tickets.created_by, user.id),
    with: {
      category: true,
      assigned_admin: true,
    },
    orderBy: desc(tickets.created_at),
  });

  // Pass to client component
  return <TicketList tickets={tickets} />;
}
```

## Error Handling

### Standard Error Responses

```typescript
// 400 Bad Request
return NextResponse.json(
  { error: "Invalid input", details: validationErrors },
  { status: 400 }
);

// 401 Unauthorized
return NextResponse.json(
  { error: "Unauthorized" },
  { status: 401 }
);

// 403 Forbidden
return NextResponse.json(
  { error: "Forbidden: Admin access required" },
  { status: 403 }
);

// 404 Not Found
return NextResponse.json(
  { error: "Resource not found" },
  { status: 404 }
);

// 500 Internal Server Error
return NextResponse.json(
  { error: "Internal server error" },
  { status: 500 }
);
```

### Client-Side Error Handling

```typescript
async function createTicket(data: FormData) {
  try {
    const response = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create ticket");
    }

    const result = await response.json();
    toast.success("Ticket created!");
    return result.ticket;
  } catch (error) {
    toast.error(error.message);
    throw error;
  }
}
```

## Validation with Zod

### Schema Definition

```typescript
const TicketSchema = z.object({
  title: z.string()
    .min(5, "Title must be at least 5 characters")
    .max(255, "Title too long"),
  description: z.string()
    .min(10, "Description must be at least 10 characters")
    .max(5000, "Description too long"),
  category_id: z.number().positive(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  metadata: z.record(z.any()).optional(),
});

type TicketInput = z.infer<typeof TicketSchema>;
```

### Validation Usage

```typescript
const parsed = TicketSchema.safeParse(body);

if (!parsed.success) {
  return NextResponse.json(
    {
      error: "Validation failed",
      details: parsed.error.format(),
    },
    { status: 400 }
  );
}

const validData = parsed.data; // Type-safe!
```

## Summary

### Technologies:
- ✅ Next.js API Routes
- ✅ Zod validation
- ✅ Clerk authentication
- ✅ Drizzle ORM
- ✅ TypeScript

### Best Practices:
- Always authenticate
- Validate on server
- Use transactions
- Return proper status codes
- Log errors
- Type-safe responses
