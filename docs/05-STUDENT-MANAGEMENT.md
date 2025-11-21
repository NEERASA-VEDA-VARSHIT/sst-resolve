# Student Management System

## Overview

Comprehensive student management with three editing methods: individual edit, UI-based bulk edit, and CSV upload. All methods automatically preserve historical ticket data.

## Technology Stack

### Individual Edit
- **React Hook Form** - Form management
- **Zod** - Validation
- **shadcn/ui Dialog** - Modal UI
- **Next.js API Routes** - Backend

### Bulk Edit (UI)
- **React State** - Selection management
- **Checkbox components** - Multi-select
- **Floating action bar** - UX pattern
- **Batch API calls** - Performance

### CSV Upload
- **File API** - File handling
- **CSV parsing** - Data extraction
- **Batch processing** - Mass updates
- **Validation** - Data integrity

## Individual Edit

### Edit Dialog Component

**File**: `src/components/admin/EditStudentDialog.tsx`

```typescript
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const EditStudentSchema = z.object({
  full_name: z.string().min(1).max(120),
  phone: z.string().max(30).nullable(),
  roll_no: z.string().min(1).max(32),
  room_no: z.string().max(16).nullable(),
  hostel_id: z.number().nullable(),
  batch_id: z.number().nullable(),
  class_section_id: z.number().nullable(),
});

export function EditStudentDialog({ studentId, onSuccess }: Props) {
  const form = useForm({
    resolver: zodResolver(EditStudentSchema),
  });

  // Fetch student data
  useEffect(() => {
    async function fetchStudent() {
      const response = await fetch(`/api/superadmin/students/${studentId}`);
      const data = await response.json();
      form.reset(data.student);
    }
    fetchStudent();
  }, [studentId]);

  async function onSubmit(data: z.infer<typeof EditStudentSchema>) {
    const response = await fetch(`/api/superadmin/students/${studentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      toast.success("Student updated");
      onSuccess();
    }
  }

  return (
    <Dialog>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          {/* Form fields */}
        </form>
      </Form>
    </Dialog>
  );
}
```

### Update API

**File**: `src/app/api/superadmin/students/[id]/route.ts`

```typescript
export async function PATCH(request: NextRequest, { params }: Props) {
  const { userId } = await auth();
  const role = await getUserRoleFromDB(userId);

  if (role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const studentId = parseInt(id);

  const body = await request.json();
  const parsed = UpdateStudentSchema.safeParse(body);

  const updateData = parsed.data;

  // Update in transaction
  await db.transaction(async (tx) => {
    // Update students table
    await tx.update(students)
      .set({ ...updateData, updated_at: new Date() })
      .where(eq(students.id, studentId));

    // Update users table if name/phone changed
    if (updateData.full_name || updateData.phone) {
      await tx.update(users)
        .set({
          name: updateData.full_name,
          phone: updateData.phone,
        })
        .where(eq(users.id, student.user_id));
    }
  });

  return NextResponse.json({ success: true });
}
```

## Bulk Edit (UI)

### Selection State Management

```typescript
const [selectedStudents, setSelectedStudents] = useState<number[]>([]);

const toggleStudent = (id: number) => {
  setSelectedStudents(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );
};

const toggleAll = () => {
  setSelectedStudents(
    selectedStudents.length === students.length
      ? []
      : students.map(s => s.student_id)
  );
};
```

### Bulk Edit Dialog

**File**: `src/components/admin/BulkEditDialog.tsx`

```typescript
export function BulkEditDialog({ selectedStudentIds }: Props) {
  const [formData, setFormData] = useState({
    hostel_id: "",
    batch_id: "",
    class_section_id: "",
  });

  async function handleSubmit() {
    const updates: any = {};
    if (formData.hostel_id) updates.hostel_id = parseInt(formData.hostel_id);
    if (formData.batch_id) updates.batch_id = parseInt(formData.batch_id);

    const response = await fetch("/api/superadmin/students/bulk-edit", {
      method: "PATCH",
      body: JSON.stringify({
        student_ids: selectedStudentIds,
        updates,
      }),
    });

    toast.success(`Updated ${selectedStudentIds.length} students`);
  }

  return (
    <Dialog>
      {/* Only show fields to update */}
      <Select value={formData.hostel_id} onValueChange={...}>
        <SelectItem value="">No change</SelectItem>
        <SelectItem value="1">Neeladri</SelectItem>
        <SelectItem value="2">Velankani</SelectItem>
      </Select>
    </Dialog>
  );
}
```

### Bulk Edit API

**File**: `src/app/api/superadmin/students/bulk-edit/route.ts`

```typescript
const BulkEditSchema = z.object({
  student_ids: z.array(z.number()).min(1),
  updates: z.object({
    hostel_id: z.number().nullable().optional(),
    batch_id: z.number().nullable().optional(),
    class_section_id: z.number().nullable().optional(),
  }),
});

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { student_ids, updates } = BulkEditSchema.parse(body);

  // Update all selected students
  await db.update(students)
    .set({ ...updates, updated_at: new Date() })
    .where(inArray(students.id, student_ids));

  return NextResponse.json({
    success: true,
    updated_count: student_ids.length,
  });
}
```

## CSV Upload

### Upload Component

**File**: `src/components/admin/StudentBulkUpload.tsx`

```typescript
export function StudentBulkUpload() {
  const [file, setFile] = useState<File | null>(null);

  async function handleUpload() {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/superadmin/students/bulk-upload", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    toast.success(`Created: ${data.created}, Updated: ${data.updated}`);
  }

  return (
    <div>
      <input type="file" accept=".csv" onChange={e => setFile(e.target.files[0])} />
      <Button onClick={handleUpload}>Upload</Button>
    </div>
  );
}
```

### CSV Processing API

**File**: `src/app/api/superadmin/students/bulk-upload/route.ts`

```typescript
import { parse } from "csv-parse/sync";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File;
  const text = await file.text();

  // Parse CSV
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
  });

  let created = 0;
  let updated = 0;

  for (const record of records) {
    // Check if student exists
    const existing = await db.query.students.findFirst({
      where: eq(students.email, record.email),
    });

    if (existing) {
      // Update
      await db.update(students)
        .set({
          full_name: record.full_name,
          room_no: record.room_number,
          // ...
        })
        .where(eq(students.id, existing.id));
      updated++;
    } else {
      // Create
      await db.insert(students).values({
        email: record.email,
        full_name: record.full_name,
        // ...
      });
      created++;
    }
  }

  return NextResponse.json({ created, updated });
}
```

## Data Integrity

### Snapshot Architecture

```typescript
// When ticket is created
const ticket = await db.insert(tickets).values({
  created_by: student.user_id,
  location: student.room_no,  // Snapshot!
  metadata: {
    hostel: student.hostel,   // Snapshot!
    batch: student.batch_year, // Snapshot!
  },
});

// When student is updated
await db.update(students).set({
  room_no: "205",  // New room
  hostel_id: 2,    // New hostel
});

// Old ticket still shows original data ✅
// New tickets will use updated data ✅
```

## Summary

### Technologies:
- ✅ React Hook Form
- ✅ Zod validation
- ✅ CSV parsing
- ✅ Batch operations
- ✅ Transaction support

### Features:
- Individual edit dialog
- UI-based bulk edit
- CSV mass upload
- Automatic data integrity
- Validation at all layers
