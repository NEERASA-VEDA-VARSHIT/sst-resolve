# Bulk Edit Students - Implementation Guide

## ✅ What's Been Created

1. **API Endpoint**: `/api/superadmin/students/bulk-edit/route.ts`
   - Accepts array of student IDs
   - Updates common fields for all selected students
   - Validates permissions (super admin only)

2. **Bulk Edit Dialog**: `/components/admin/BulkEditDialog.tsx`
   - Select which fields to update
   - Apply to all selected students
   - "No change" option for each field

## 🔧 How to Add to Students Page

Update `src/app/(app)/superadmin/students/page.tsx`:

### Step 1: Add Imports

```typescript
import { Checkbox } from "@/components/ui/checkbox";
import { BulkEditDialog } from "@/components/admin/BulkEditDialog";
import { Edit2 } from "lucide-react";
```

### Step 2: Add State

```typescript
const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
```

### Step 3: Add Selection Handlers

```typescript
const toggleStudent = (studentId: number) => {
  setSelectedStudents((prev) =>
    prev.includes(studentId)
      ? prev.filter((id) => id !== studentId)
      : [...prev, studentId]
  );
};

const toggleAll = () => {
  if (selectedStudents.length === students.length) {
    setSelectedStudents([]);
  } else {
    setSelectedStudents(students.map((s) => s.student_id));
  }
};

const clearSelection = () => {
  setSelectedStudents([]);
};
```

### Step 4: Add Checkbox Column to Table Header

```typescript
<TableHeader>
  <TableRow>
    <TableHead className="w-12">
      <Checkbox
        checked={selectedStudents.length === students.length && students.length > 0}
        onCheckedChange={toggleAll}
      />
    </TableHead>
    <TableHead>Roll No</TableHead>
    <TableHead>Name</TableHead>
    {/* ... other headers ... */}
  </TableRow>
</TableHeader>
```

### Step 5: Add Checkbox to Each Row

```typescript
<TableBody>
  {students.map((student) => (
    <TableRow key={student.student_id}>
      <TableCell>
        <Checkbox
          checked={selectedStudents.includes(student.student_id)}
          onCheckedChange={() => toggleStudent(student.student_id)}
        />
      </TableCell>
      <TableCell>{student.roll_no}</TableCell>
      {/* ... other cells ... */}
    </TableRow>
  ))}
</TableBody>
```

### Step 6: Add Bulk Actions Bar

```typescript
{/* Bulk Actions Bar - Show when students are selected */}
{selectedStudents.length > 0 && (
  <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
    <Card className="shadow-lg border-2">
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <span className="font-semibold">
            {selectedStudents.length} student{selectedStudents.length !== 1 ? "s" : ""} selected
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowBulkEditDialog(true)}
          >
            <Edit2 className="w-4 h-4 mr-2" />
            Bulk Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearSelection}
          >
            Clear Selection
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
)}
```

### Step 7: Add Bulk Edit Dialog

```typescript
{/* Bulk Edit Dialog */}
<BulkEditDialog
  open={showBulkEditDialog}
  onOpenChange={setShowBulkEditDialog}
  selectedStudentIds={selectedStudents}
  onSuccess={() => {
    fetchStudents(); // Refresh the list
    setSelectedStudents([]); // Clear selection
    setShowBulkEditDialog(false);
  }}
/>
```

## 📝 Complete Example

Here's what the updated page structure should look like:

```typescript
"use client";

import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkEditDialog } from "@/components/admin/BulkEditDialog";
import { Edit2, Users } from "lucide-react";
// ... other imports

export default function SuperAdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  // ... other state

  const toggleStudent = (studentId: number) => {
    setSelectedStudents((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const toggleAll = () => {
    if (selectedStudents.length === students.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(students.map((s) => s.student_id));
    }
  };

  const clearSelection = () => {
    setSelectedStudents([]);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* ... existing header and filters ... */}

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedStudents.length === students.length && students.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Roll No</TableHead>
                <TableHead>Name</TableHead>
                {/* ... other headers ... */}
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.student_id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedStudents.includes(student.student_id)}
                      onCheckedChange={() => toggleStudent(student.student_id)}
                    />
                  </TableCell>
                  <TableCell>{student.roll_no}</TableCell>
                  {/* ... other cells ... */}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      {selectedStudents.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <Card className="shadow-lg border-2">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <span className="font-semibold">
                  {selectedStudents.length} student{selectedStudents.length !== 1 ? "s" : ""} selected
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowBulkEditDialog(true)}
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Bulk Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                >
                  Clear Selection
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bulk Edit Dialog */}
      <BulkEditDialog
        open={showBulkEditDialog}
        onOpenChange={setShowBulkEditDialog}
        selectedStudentIds={selectedStudents}
        onSuccess={() => {
          fetchStudents();
          setSelectedStudents([]);
          setShowBulkEditDialog(false);
        }}
      />
    </div>
  );
}
```

## 🎯 How It Works

### User Flow:
1. **Select Students**: Click checkboxes next to students
2. **Bulk Actions Bar Appears**: Shows count and actions at bottom of screen
3. **Click "Bulk Edit"**: Opens dialog with field options
4. **Choose Fields**: Select which fields to update (hostel, batch, section, etc.)
5. **Save**: All selected students updated at once
6. **Success**: Toast notification + table refreshes + selection clears

### Features:
- ✅ Select individual students
- ✅ "Select All" checkbox in header
- ✅ Floating action bar (appears when students selected)
- ✅ Update common fields only
- ✅ "No change" option for each field
- ✅ Clear/null option for each field
- ✅ Historical ticket data preserved automatically

## 🔒 Data Integrity

Just like individual and CSV bulk updates:
- ✅ Student records updated
- ✅ **Old tickets keep original data**
- ✅ New tickets use updated data
- ✅ **Automatic protection - no manual work!**

## 💡 Use Cases

### Scenario 1: Hostel Shuffle
```
1. Select 50 students from Neeladri
2. Click "Bulk Edit"
3. Change Hostel → Velankani
4. Save
Result: All 50 moved to Velankani, old tickets unchanged ✅
```

### Scenario 2: Section Reassignment
```
1. Select 20 students
2. Click "Bulk Edit"
3. Change Section → B
4. Save
Result: All 20 now in Section B ✅
```

### Scenario 3: Batch Year Update
```
1. Select All (200 students)
2. Click "Bulk Edit"
3. Change Batch Year → 2027
4. Save
Result: All 200 updated instantly ✅
```

## 🎨 UI Preview

```
┌─────────────────────────────────────────────────────┐
│ ☑ Roll No  Name      Email     Hostel    Room      │
├─────────────────────────────────────────────────────┤
│ ☑ 24bcs001 John Doe  john@...  Neeladri  101       │
│ ☑ 24bcs002 Jane Doe  jane@...  Neeladri  102       │
│ ☐ 24bcs003 Bob Smith bob@...   Velankani 201       │
└─────────────────────────────────────────────────────┘

        ┌──────────────────────────────────┐
        │ 👥 2 students selected           │
        │  [Bulk Edit]  [Clear Selection]  │
        └──────────────────────────────────┘
                  ↑ Floating at bottom
```

## 📦 Files Created

1. `/api/superadmin/students/bulk-edit/route.ts` - API endpoint
2. `/components/admin/BulkEditDialog.tsx` - Dialog component
3. `BULK_EDIT_IMPLEMENTATION.md` - This guide

## 🚀 Next Steps

1. Add the code changes to `src/app/(app)/superadmin/students/page.tsx`
2. Test by selecting a few students
3. Try bulk editing their hostel or batch
4. Verify old tickets still show original data
5. Verify new tickets show updated data

## ✨ Summary

You now have **three ways** to update students:

1. **Individual Edit** (API ready, needs button)
   - Quick single-student changes
   - Full form with all fields

2. **Bulk Edit** (Ready to implement)
   - Select multiple students in UI
   - Update common fields
   - Instant visual feedback

3. **CSV Upload** (Already working)
   - Mass updates via file
   - Create + update in one go
   - Best for large batches

All three methods automatically preserve historical ticket data! 🎉
