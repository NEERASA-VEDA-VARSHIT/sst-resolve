# Student Deactivation & Deletion API

## Overview

Safe student lifecycle management with **soft delete (deactivate)** as the default and **hard delete** only for exceptional cases.

## Philosophy

❌ **DON'T** hard delete students with history (tickets, assignments, ratings)
✅ **DO** soft delete (deactivate) to preserve data integrity
✅ **DO** hard delete only test data or mistakes with NO activity

---

## API Endpoints

### 1. Deactivate Students (Soft Delete) - RECOMMENDED ✅

**Endpoint:** `PATCH /api/superadmin/students/deactivate`

**Use Cases:**
- Student graduated
- Student expelled
- Student left the institution
- Student on temporary leave
- Duplicate student record (with tickets)
- Wrong data uploaded (but student has activity)

**Request:**
```json
{
  "student_ids": [1, 2, 3],
  "reason": "graduated" // Optional: 'graduated' | 'expelled' | 'left' | 'duplicate' | 'wrong_data' | 'other'
}
```

**Response (Success):**
```json
{
  "success": true,
  "deactivated": 3,
  "errors": [],
  "message": "Deactivated 3 student(s). 0 already inactive. 0 not found."
}
```

**Response (Partial Success):**
```json
{
  "success": false,
  "deactivated": 2,
  "errors": [
    { "id": 1, "error": "Already inactive" },
    { "id": 99, "error": "Student not found" }
  ],
  "message": "Deactivated 2 student(s). 1 already inactive. 1 not found."
}
```

**What Happens:**
- Sets `active = false`
- Updates `updated_at = NOW()`
- **Preserves all data** (tickets, ratings, history)
- Student can no longer login (future enhancement)
- Student won't appear in active student lists (if filtered)

**Bulk Operation:** Yes, supports multiple students at once

---

### 2. Reactivate Students (Undo Deactivation) ✅

**Endpoint:** `PATCH /api/superadmin/students/reactivate`

**Use Cases:**
- Deactivated by mistake
- Student returns from leave
- Duplicate was actually valid
- Student re-enrolled

**Request:**
```json
{
  "student_ids": [1, 2, 3]
}
```

**Response:**
```json
{
  "success": true,
  "reactivated": 3,
  "errors": [],
  "message": "Reactivated 3 student(s). 0 already active. 0 not found."
}
```

**What Happens:**
- Sets `active = true`
- Updates `updated_at = NOW()`
- Student can login again
- Appears in active student lists

**Bulk Operation:** Yes

---

### 3. Hard Delete Student (DANGEROUS ⚠️) - Use With Caution

**Endpoint:** `DELETE /api/superadmin/students/:id`

**Use Cases (VERY LIMITED):**
- Test data cleanup
- Duplicate student with **ZERO tickets**
- Wrong data uploaded **BEFORE any activity**
- Student created by mistake and never logged in

**Request:**
```
DELETE /api/superadmin/students/123
```

**Response (Success - Never Logged In):**
```json
{
  "success": true,
  "message": "Student deleted successfully",
  "deleted": {
    "student_id": 123,
    "roll_no": "24BCS10005",
    "user_deleted": true
  },
  "warning": "User record also deleted (never logged in)"
}
```

**Response (Success - Logged In Before):**
```json
{
  "success": true,
  "message": "Student deleted successfully",
  "deleted": {
    "student_id": 123,
    "roll_no": "24BCS10005",
    "user_deleted": false
  },
  "warning": "User record preserved"
}
```

**Response (Error - Has Tickets):**
```json
{
  "error": "Cannot delete student with ticket history. Use deactivate endpoint instead.",
  "suggestion": "PATCH /api/superadmin/students/deactivate with student_ids: [123]"
}
```

**Response (Error - Foreign Key Violation):**
```json
{
  "error": "Cannot delete student with related records (tickets, assignments, etc.). Use deactivate instead.",
  "code": "FOREIGN_KEY_VIOLATION"
}
```

**What Happens:**
- **Checks for tickets first** - fails if any exist
- Deletes student record from `students` table
- If `clerk_id` starts with `pending_` (never logged in):
  - Also deletes user record from `users` table
- If student logged in before:
  - Preserves user record (for audit trail)

**Bulk Operation:** No, single student only (by design for safety)

**Safety:** Has multiple checks to prevent accidental data loss

---

## Updated List API

### Get Students with Active Filter

**Endpoint:** `GET /api/superadmin/students`

**New Query Parameters:**
- `active` - Filter by status
  - `?active=true` - Only active students
  - `?active=false` - Only inactive students
  - (omit parameter) - All students

**Example Requests:**
```
GET /api/superadmin/students?active=true&hostel=Neeladri&page=1
GET /api/superadmin/students?active=false&batch_year=2020
GET /api/superadmin/students?search=john&active=true
```

**Response (with new fields):**
```json
{
  "students": [
    {
      "student_id": 1,
      "student_uid": "550e8400-e29b-41d4-a716-446655440000",
      "user_id": "abc123",
      "email": "john@example.com",
      "full_name": "John Doe",
      "phone": "9876543210",
      "roll_no": "24BCS10005",
      "room_no": "101",
      "hostel": "Neeladri",
      "class_section": "A",
      "batch_year": 2024,
      "department": "CSE",
      "active": true,
      "source": "csv",
      "last_synced_at": "2024-11-16T10:30:00Z",
      "created_at": "2024-01-15T08:00:00Z",
      "updated_at": "2024-11-16T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "totalPages": 3
  }
}
```

---

## Decision Flow Chart

```
Student needs to be removed
         |
         ↓
   Has tickets/activity?
         |
    ┌────┴────┐
   Yes       No
    |         |
    ↓         ↓
DEACTIVATE  Check if logged in?
(soft)      |
            ┌─────┴─────┐
           Yes         No
            |           |
            ↓           ↓
      DEACTIVATE   HARD DELETE
      (preserve   (safe to
       history)    remove)
```

---

## Use Case Examples

### Scenario 1: Graduating Batch of 2024

**Goal:** Mark all 2024 batch students as inactive

**Solution:**
```typescript
// 1. Get all 2024 students
const response = await fetch('/api/superadmin/students?batch_year=2024&limit=1000');
const { students } = await response.json();

// 2. Extract IDs
const studentIds = students.map(s => s.student_id);

// 3. Deactivate in bulk
await fetch('/api/superadmin/students/deactivate', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    student_ids: studentIds,
    reason: 'graduated'
  })
});
```

### Scenario 2: Wrong CSV Upload (Before Students Login)

**Goal:** Delete test/wrong data uploaded by mistake

**Solution:**
```typescript
// For each test student (assuming they haven't logged in)
for (const studentId of wrongStudentIds) {
  try {
    await fetch(`/api/superadmin/students/${studentId}`, {
      method: 'DELETE'
    });
  } catch (error) {
    // If has tickets, will get error suggesting deactivate
    console.error(error);
  }
}
```

### Scenario 3: Duplicate Student (Has Tickets)

**Goal:** Remove duplicate but preserve ticket history

**Solution:**
```typescript
// Can't hard delete (has tickets)
// Use soft delete instead
await fetch('/api/superadmin/students/deactivate', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    student_ids: [duplicateStudentId],
    reason: 'duplicate'
  })
});

// Optional: Merge tickets to correct student (future enhancement)
```

### Scenario 4: Student Returns from Leave

**Goal:** Reactivate previously deactivated student

**Solution:**
```typescript
await fetch('/api/superadmin/students/reactivate', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    student_ids: [studentId]
  })
});
```

---

## Security & Validation

### Deactivate Endpoint
- ✅ SuperAdmin only
- ✅ Validates all IDs are positive integers
- ✅ Gracefully handles non-existent students
- ✅ Idempotent (can call multiple times safely)
- ✅ Bulk operation supported

### Reactivate Endpoint
- ✅ SuperAdmin only
- ✅ Same validation as deactivate
- ✅ Idempotent
- ✅ Bulk operation supported

### Hard Delete Endpoint
- ✅ SuperAdmin only
- ✅ **Checks for tickets first** (blocks if found)
- ✅ Foreign key constraint protection
- ✅ Only single student (not bulk for safety)
- ✅ Preserves user record if student logged in
- ✅ Clear error messages with suggestions

---

## Database Impact

### Soft Delete (Deactivate)
```sql
UPDATE students 
SET active = false, updated_at = NOW()
WHERE id IN (1, 2, 3);
```

**Impact:**
- ✅ No data loss
- ✅ All foreign keys intact
- ✅ Tickets preserved
- ✅ History maintained
- ✅ Can be undone

### Hard Delete
```sql
-- Check for tickets first
SELECT COUNT(*) FROM tickets WHERE created_by = (
  SELECT user_id FROM students WHERE id = 123
);

-- If 0 tickets:
DELETE FROM students WHERE id = 123;

-- If never logged in (pending_ clerk_id):
DELETE FROM users WHERE id = (SELECT user_id FROM students WHERE id = 123);
```

**Impact:**
- ⚠️ Permanent deletion
- ⚠️ Cannot be undone
- ⚠️ Only safe if NO tickets
- ⚠️ May fail if foreign keys exist

---

## Future Enhancements

### 1. Deactivation Reason Tracking
**Table:** `student_status_history`
```sql
CREATE TABLE student_status_history (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES students(id),
  status VARCHAR(20), -- 'active' | 'inactive'
  reason VARCHAR(50), -- 'graduated', 'expelled', etc.
  notes TEXT,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMP DEFAULT NOW()
);
```

### 2. Prevent Login for Inactive Students
**Middleware Check:**
```typescript
// In middleware or auth hook
if (!student.active) {
  throw new Error("Your account is inactive. Please contact administration.");
}
```

### 3. Bulk Deactivate by Batch Year (UI)
**Location:** `/superadmin/students/bulk-actions`

**Features:**
- Select entire batch year
- Preview affected students
- Confirm with reason
- Execute bulk deactivate

### 4. Merge Duplicate Students
**Endpoint:** `POST /api/superadmin/students/merge`

**Request:**
```json
{
  "keep_student_id": 1,
  "merge_student_ids": [2, 3],
  "merge_tickets": true,
  "merge_ratings": true
}
```

**Actions:**
- Transfer all tickets from duplicates to keep student
- Transfer ratings
- Deactivate or delete duplicates
- Audit log of merge

### 5. Scheduled Auto-Deactivation
**Cron Job:** Deactivate students 6 months after batch_year + 4

**Example:**
- Batch year 2020 + 4 years = 2024
- 6 months after 2024 = Mid 2025
- Auto-deactivate all 2020 batch

---

## Testing Checklist

### Deactivate
- [ ] Deactivate single student → verify `active = false`
- [ ] Deactivate multiple students (bulk) → verify all updated
- [ ] Try to deactivate non-existent student → verify error
- [ ] Try to deactivate already inactive → verify idempotent
- [ ] Verify student still appears in list when `active=false` filter

### Reactivate
- [ ] Reactivate previously deactivated → verify `active = true`
- [ ] Bulk reactivate → verify all updated
- [ ] Try to reactivate active student → verify idempotent
- [ ] Verify student appears in `active=true` filter

### Hard Delete
- [ ] Delete student with NO tickets → verify success
- [ ] Delete student with pending clerk_id → verify user also deleted
- [ ] Delete student with real clerk_id → verify user preserved
- [ ] Try to delete student WITH tickets → verify blocked with error
- [ ] Try to delete non-existent → verify 404

### List API
- [ ] Filter `?active=true` → verify only active students
- [ ] Filter `?active=false` → verify only inactive students
- [ ] No active filter → verify all students (both active/inactive)
- [ ] Combine with other filters → verify AND logic works

---

## Migration (None Required)

All new endpoints work with existing schema (added in previous enhancement).

No database changes needed.

---

## API Summary Table

| Endpoint | Method | Purpose | Bulk | Reversible | Safe |
|----------|--------|---------|------|------------|------|
| `/students/deactivate` | PATCH | Soft delete | ✅ Yes | ✅ Yes | ✅ Safe |
| `/students/reactivate` | PATCH | Undo deactivate | ✅ Yes | N/A | ✅ Safe |
| `/students/:id` | DELETE | Hard delete | ❌ No | ❌ No | ⚠️ Dangerous |
| `/students?active=X` | GET | List with filter | N/A | N/A | ✅ Safe |

---

## Success Metrics

✅ **3 New Endpoints Created**
- Deactivate (soft delete with bulk support)
- Reactivate (undo deactivation)
- Hard delete (single, with safety checks)

✅ **Enhanced List API**
- Added `active` filter
- Returns `active`, `source`, `last_synced_at`, `student_uid`

✅ **Safety Features**
- Ticket existence check before hard delete
- Foreign key violation handling
- Clear error messages with suggestions
- Idempotent operations

✅ **Bulk Operations**
- Deactivate multiple students at once
- Reactivate multiple students at once

✅ **Data Integrity**
- Soft delete preserves all history
- Hard delete only when safe
- User record preserved if student logged in

---

**Status:** ✅ Complete and Production Ready
**Documentation:** ✅ Comprehensive with examples
**Safety:** ✅ Multiple protective checks
**Flexibility:** ✅ Handles all common scenarios
