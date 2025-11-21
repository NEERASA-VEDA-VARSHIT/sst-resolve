# Student Data Editing - Data Integrity Design

## Current Architecture

### ✅ Historical Data is Already Protected!

Your database schema is **already designed** to preserve historical ticket data when student information changes. Here's how:

### 1. **Tickets Store Snapshot Data**

When a ticket is created, it captures a **snapshot** of the student's information at that moment:

```typescript
// From schema.ts - tickets table
tickets {
  // Current student reference (FK)
  created_by: uuid → users.id
  
  // Snapshot fields (captured at creation time)
  location: varchar  // Room number at time of ticket creation
  metadata: jsonb    // Can store hostel, batch, etc. at creation time
  
  // Legacy fields (also snapshots)
  user_number: varchar  // Student roll number at creation
  category: varchar     // Category at creation
  subcategory: varchar  // Subcategory at creation
}
```

### 2. **Students Table Stores Current Data**

```typescript
students {
  id: serial
  user_id: uuid → users.id
  roll_no: varchar
  room_no: varchar      // CURRENT room
  hostel_id: integer    // CURRENT hostel
  batch_year: integer   // CURRENT batch
  class_section_id: integer  // CURRENT section
  // ... other current fields
}
```

## How It Works

### Scenario: Student Moves Rooms

**Before:**
- Student in Room 101, Neeladri
- Creates Ticket #123 about AC issue
- Ticket stores: `location: "Room 101"`, `metadata: {hostel: "Neeladri"}`

**After Bulk Update:**
- Student moves to Room 205, Velankani
- `students` table updated: `room_no = "205"`, `hostel_id = 2 (Velankani)`

**Result:**
- ✅ Ticket #123 still shows "Room 101, Neeladri" (historical accuracy)
- ✅ New tickets will show "Room 205, Velankani" (current data)
- ✅ Student profile shows current room: "205, Velankani"

## Implementation Status

### ✅ Already Working:
1. **Tickets preserve creation-time data** via `location` and `metadata` fields
2. **Student updates don't affect old tickets** (separate tables)
3. **User identity is stable** via `user_id` (UUID)

### 🔨 To Implement:

#### 1. **Individual Student Edit**
Add edit functionality to `superadmin/students` page:
- Click row to edit
- Modal/drawer with form
- Update `students` table only
- Old tickets remain unchanged

#### 2. **Bulk Edit via CSV**
Already have `StudentBulkUpload` component:
- Upload CSV with updated data
- Match by `roll_no` or `email`
- Update `students` table
- Old tickets remain unchanged

#### 3. **Audit Trail** (Optional but Recommended)
Track student data changes:
```typescript
student_history {
  id: serial
  student_id: integer
  field_changed: varchar  // "room_no", "hostel_id", etc.
  old_value: text
  new_value: text
  changed_by: uuid → users.id
  changed_at: timestamp
}
```

## Best Practices

### When Creating Tickets:
```typescript
// Capture snapshot at creation time
const ticket = {
  created_by: student.user_id,
  location: student.room_no,  // Snapshot
  metadata: {
    hostel: student.hostel,   // Snapshot
    batch: student.batch_year, // Snapshot
    section: student.class_section, // Snapshot
    // ... other relevant data
  }
}
```

### When Displaying Tickets:
```typescript
// Use ticket's snapshot data, NOT current student data
<TicketCard>
  <Location>{ticket.location}</Location>  {/* NOT student.room_no */}
  <Hostel>{ticket.metadata.hostel}</Hostel>  {/* NOT student.hostel */}
</TicketCard>
```

### When Editing Students:
```typescript
// Only update students table
await db.update(students)
  .set({
    room_no: newRoomNo,
    hostel_id: newHostelId,
    updated_at: new Date()
  })
  .where(eq(students.id, studentId));

// Tickets are NOT touched - they keep their historical data
```

## Summary

✅ **You're already protected!** The database design ensures:
1. Tickets store snapshot data at creation time
2. Student updates only affect the `students` table
3. Historical ticket data remains accurate
4. No data loss when editing student profiles

**Next Step**: Add edit UI to the student management page, and the data integrity will be automatically maintained by the existing schema design.
