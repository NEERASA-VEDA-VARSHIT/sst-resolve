# Ticket Management System

## Overview

The ticket management system is the core of SST-Resolve, handling the entire lifecycle from creation to resolution. It uses dynamic forms, automated assignment, and sophisticated status management.

## Technology Stack

### Form Management
- **React Hook Form** (`react-hook-form`) - Form state and validation
- **Zod** (`zod`) - Schema validation
- **@hookform/resolvers** - Zod integration with React Hook Form

### UI Components
- **shadcn/ui** - Pre-built components
- **Radix UI** - Headless UI primitives
- **Tailwind CSS** - Styling

### State Management
- **React useState/useEffect** - Local state
- **Next.js Server Actions** - Server mutations
- **Optimistic Updates** - Instant UI feedback

### Backend
- **Drizzle ORM** - Database operations
- **PostgreSQL** - Data storage
- **Next.js API Routes** - RESTful endpoints

## Ticket Creation Flow

### 1. Dynamic Form Rendering

**File**: `src/components/tickets/TicketForm.tsx`

```typescript
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Dynamic schema based on category
const createTicketSchema = (fields: CategoryField[]) => {
  const shape: any = {
    title: z.string().min(5).max(255),
    description: z.string().min(10).max(5000),
    category_id: z.number(),
  };

  // Add dynamic fields
  fields.forEach((field) => {
    if (field.field_type === "text") {
      shape[field.slug] = field.required
        ? z.string().min(1, `${field.name} is required`)
        : z.string().optional();
    } else if (field.field_type === "number") {
      shape[field.slug] = field.required
        ? z.number()
        : z.number().optional();
    }
    // ... other field types
  });

  return z.object(shape);
};

export function TicketForm({ category }: Props) {
  const [fields, setFields] = useState<CategoryField[]>([]);
  
  // Fetch dynamic fields for selected category
  useEffect(() => {
    async function fetchFields() {
      const response = await fetch(`/api/categories/${category.id}/fields`);
      const data = await response.json();
      setFields(data.fields);
    }
    if (category) fetchFields();
  }, [category]);

  // Create dynamic schema
  const schema = createTicketSchema(fields);
  
  // Initialize React Hook Form
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      category_id: category.id,
    },
  });

  async function onSubmit(data: z.infer<typeof schema>) {
    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to create ticket");

      const result = await response.json();
      toast.success("Ticket created successfully!");
      router.push(`/student/dashboard/ticket/${result.ticket.id}`);
    } catch (error) {
      toast.error("Failed to create ticket");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* Static fields */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Brief description" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Dynamic fields */}
        {fields.map((categoryField) => (
          <DynamicField
            key={categoryField.id}
            field={categoryField}
            control={form.control}
          />
        ))}

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Creating..." : "Create Ticket"}
        </Button>
      </form>
    </Form>
  );
}
```

**Technologies Used:**
- **React Hook Form** - Form state management
- **Zod** - Runtime validation
- **Dynamic schema generation** - Based on category
- **shadcn/ui Form components** - Pre-styled inputs

**Key Features:**
- ✅ Dynamic field rendering
- ✅ Type-safe validation
- ✅ Automatic error handling
- ✅ Loading states
- ✅ Optimistic UI updates

### 2. File Upload

**File**: `src/components/tickets/FileUpload.tsx`

```typescript
"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";

export function FileUpload({ onUpload }: Props) {
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setUploading(true);

    try {
      const formData = new FormData();
      acceptedFiles.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      const data = await response.json();
      setFiles((prev) => [...prev, ...data.files]);
      onUpload(data.files);
      toast.success(`${acceptedFiles.length} file(s) uploaded`);
    } catch (error) {
      toast.error("Failed to upload files");
    } finally {
      setUploading(false);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif"],
      "application/pdf": [".pdf"],
    },
    maxSize: 5 * 1024 * 1024, // 5MB
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer",
          isDragActive && "border-primary bg-primary/10"
        )}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p>Drop files here...</p>
        ) : (
          <p>Drag & drop files, or click to select</p>
        )}
      </div>

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((file) => (
            <FilePreview key={file.id} file={file} />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Technologies Used:**
- **react-dropzone** - Drag & drop file upload
- **FormData API** - File upload
- **Next.js API Routes** - File handling
- **Cloud Storage** (Cloudinary/S3) - File storage

### 3. Ticket Creation API

**File**: `src/app/api/tickets/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tickets, outbox } from "@/db/schema";
import { z } from "zod";

const CreateTicketSchema = z.object({
  title: z.string().min(5).max(255),
  description: z.string().min(10).max(5000),
  category_id: z.number(),
  location: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  attachments: z.array(z.object({
    url: z.string(),
    storage_key: z.string(),
    mime: z.string(),
    size: z.number(),
  })).optional(),
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

    // 3. Validate input
    const body = await request.json();
    const parsed = CreateTicketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // 4. Find category and assign admin
    const category = await db.query.categories.findFirst({
      where: eq(categories.id, data.category_id),
      with: { default_authority: true },
    });

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // 5. Create ticket in transaction
    const [ticket] = await db.transaction(async (tx) => {
      // Insert ticket
      const [newTicket] = await tx.insert(tickets).values({
        title: data.title,
        description: data.description,
        category_id: data.category_id,
        created_by: user.id,
        assigned_to: category.default_authority?.id,
        status: TICKET_STATUS.OPEN,
        location: data.location,
        metadata: data.metadata,
        attachments: data.attachments,
        due_at: calculateDueDate(category.sla_hours),
      }).returning();

      // Create outbox event for notifications
      await tx.insert(outbox).values({
        event_type: "ticket.created",
        payload: {
          ticket_id: newTicket.id,
          student_id: user.id,
          assigned_admin_id: newTicket.assigned_to,
        },
      });

      return [newTicket];
    });

    return NextResponse.json({
      success: true,
      ticket,
    }, { status: 201 });

  } catch (error) {
    console.error("Error creating ticket:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Technologies Used:**
- **Zod** - Request validation
- **Drizzle ORM** - Database operations
- **PostgreSQL Transactions** - Data consistency
- **Outbox Pattern** - Reliable event processing

**Flow:**
1. Authenticate user
2. Validate request body
3. Find category and default admin
4. Create ticket + outbox event (transaction)
5. Return created ticket

## Status Management

### Status Flow

```
OPEN → IN_PROGRESS → AWAITING_STUDENT → IN_PROGRESS → RESOLVED
  ↓                       ↓                              ↓
ESCALATED            REOPENED                      REOPENED
  ↓
FORWARDED
```

### Status Update API

**File**: `src/app/api/tickets/[id]/status/route.ts`

```typescript
const UpdateStatusSchema = z.object({
  status: z.enum([
    "OPEN",
    "IN_PROGRESS",
    "AWAITING_STUDENT",
    "ESCALATED",
    "FORWARDED",
    "RESOLVED",
    "REOPENED",
  ]),
  comment: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  const role = await getUserRoleFromDB(userId);

  // Only admins can change status
  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const ticketId = parseInt(id);

  const body = await request.json();
  const parsed = UpdateStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { status, comment } = parsed.data;

  // Update ticket and create activity log
  await db.transaction(async (tx) => {
    // Update ticket status
    await tx.update(tickets)
      .set({
        status,
        updated_at: new Date(),
        ...(status === "RESOLVED" && { resolved_at: new Date() }),
      })
      .where(eq(tickets.id, ticketId));

    // Log activity
    await tx.insert(activity_logs).values({
      ticket_id: ticketId,
      user_id: (await getOrCreateUser(userId)).id,
      action: "status_change",
      details: { old_status: ticket.status, new_status: status, comment },
    });

    // Create outbox event
    await tx.insert(outbox).values({
      event_type: "ticket.status_changed",
      payload: { ticket_id: ticketId, new_status: status },
    });
  });

  return NextResponse.json({ success: true });
}
```

**Technologies Used:**
- **Zod enum validation** - Type-safe status values
- **Database transactions** - Atomic updates
- **Activity logging** - Audit trail
- **Outbox pattern** - Notifications

## Assignment Logic

### Auto-Assignment

**File**: `src/lib/ticket-assignment.ts`

```typescript
export async function assignTicket(ticketId: number, categoryId: number) {
  // 1. Get category with default authority
  const category = await db.query.categories.findFirst({
    where: eq(categories.id, categoryId),
    with: {
      default_authority: true,
      subcategories: {
        with: { assigned_admin: true },
      },
    },
  });

  // 2. Check for subcategory-specific assignment
  if (ticket.metadata?.subcategory) {
    const subcategory = category.subcategories.find(
      (sub) => sub.slug === ticket.metadata.subcategory
    );
    if (subcategory?.assigned_admin) {
      return subcategory.assigned_admin.id;
    }
  }

  // 3. Use category default
  if (category.default_authority) {
    return category.default_authority.id;
  }

  // 4. Fallback to domain-based assignment
  const domain = category.domain; // "Hostel" or "College"
  const scope = ticket.metadata?.hostel; // "Neeladri" or "Velankani"

  const admin = await db.query.staff.findFirst({
    where: and(
      eq(staff.domain, domain),
      scope ? eq(staff.scope, scope) : undefined
    ),
  });

  return admin?.id || null;
}
```

**Assignment Priority:**
1. Subcategory-specific admin
2. Category default authority
3. Domain/scope-based admin
4. Null (manual assignment needed)

## Ticket Display

### Ticket Card Component

**File**: `src/components/tickets/TicketCard.tsx`

```typescript
"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { STATUS_DISPLAY, STATUS_VARIANT } from "@/conf/constants";
import { formatDistanceToNow } from "date-fns";

export function TicketCard({ ticket }: { ticket: Ticket }) {
  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{ticket.title}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {ticket.description}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[ticket.status]}>
          {STATUS_DISPLAY[ticket.status]}
        </Badge>
      </div>

      <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
        <span>#{ticket.id}</span>
        <span>•</span>
        <span>{ticket.category_name}</span>
        <span>•</span>
        <span>{formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}</span>
      </div>

      {ticket.due_at && (
        <div className="mt-2">
          <DueDateBadge dueDate={ticket.due_at} />
        </div>
      )}
    </Card>
  );
}
```

**Technologies Used:**
- **shadcn/ui** - Card, Badge components
- **date-fns** - Date formatting
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety

## Search and Filtering

### Search Implementation

**File**: `src/components/tickets/TicketSearch.tsx`

```typescript
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";

export function TicketSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");

  // Debounce search to avoid too many API calls
  const debouncedSearch = useDebouncedCallback((value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set("search", value);
    } else {
      params.delete("search");
    }
    params.set("page", "1"); // Reset to first page
    router.push(`?${params.toString()}`);
  }, 300);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    debouncedSearch(value);
  };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        value={search}
        onChange={handleChange}
        placeholder="Search tickets..."
        className="pl-10"
      />
    </div>
  );
}
```

**Technologies Used:**
- **use-debounce** - Debounced input
- **Next.js useSearchParams** - URL state
- **Next.js useRouter** - Navigation

### Filter Implementation

**File**: `src/components/tickets/TicketFilters.tsx`

```typescript
"use client";

export function TicketFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set("page", "1");
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex gap-4">
      <Select
        value={searchParams.get("status") || "all"}
        onValueChange={(value) => updateFilter("status", value)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="OPEN">Open</SelectItem>
          <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
          <SelectItem value="RESOLVED">Resolved</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("category") || "all"}
        onValueChange={(value) => updateFilter("category", value)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {categories.map((cat) => (
            <SelectItem key={cat.id} value={cat.id.toString()}>
              {cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

**Technologies Used:**
- **URL state management** - Filters in URL
- **Next.js navigation** - Client-side routing
- **shadcn/ui Select** - Dropdown components

## Summary

### Technologies Used:
- ✅ **React Hook Form** - Form management
- ✅ **Zod** - Validation
- ✅ **Drizzle ORM** - Database
- ✅ **PostgreSQL** - Storage
- ✅ **Next.js API Routes** - Backend
- ✅ **shadcn/ui** - UI components
- ✅ **date-fns** - Date formatting
- ✅ **use-debounce** - Performance
- ✅ **react-dropzone** - File upload

### Key Features:
- Dynamic form generation
- Type-safe validation
- Auto-assignment logic
- Status management
- File uploads
- Search and filtering
- Activity logging
- Event-driven notifications

### Best Practices:
- Validate on client and server
- Use transactions for consistency
- Debounce user input
- Store filters in URL
- Log all changes
- Use outbox pattern for events
