# Student Tracking Enhancements

## Overview

Enhanced the student profile system with robust tracking, data quality, and lifecycle management features.

## New Features

### 1. Active/Inactive Status Flag ✅

**Purpose:** Track student lifecycle status

**Use Cases:**
- Student graduates → set `active = false`
- Student expelled → set `active = false`
- Student on leave (temporarily inactive) → set `active = false`
- Student returns from leave → set `active = true`

**Implementation:**
```typescript
// In schema.ts
active: boolean("active").default(true).notNull()
```

**Default:** All students are `active = true` by default

**Future:** SuperAdmin UI to toggle active status, filter by active/inactive in list view

---

### 2. Sync Source Tracking ✅

**Purpose:** Track origin of student data for debugging data mismatches

**Possible Values:**
- `'csv'` - Created/updated via CSV bulk upload (default)
- `'manual'` - Manually created by admin via UI
- `'api'` - Created via API integration
- `'import'` - One-time bulk import from legacy system

**Implementation:**
```typescript
// In schema.ts
source: varchar("source", { length: 20 }).default("csv").notNull()
```

**Usage:**
```sql
-- Find all students created via CSV
SELECT * FROM students WHERE source = 'csv';

-- Find manually created records
SELECT * FROM students WHERE source = 'manual';

-- Diagnose data quality issues by source
SELECT source, COUNT(*), AVG(CASE WHEN hostel IS NULL THEN 1 ELSE 0 END) as missing_hostel_rate
FROM students
GROUP BY source;
```

---

### 3. Last Synced Timestamp ✅

**Purpose:** Track when student record was last updated via sync operations

**Implementation:**
```typescript
// In schema.ts
last_synced_at: timestamp("last_synced_at")
```

**Usage:**
- Set to `NOW()` on CSV upload (create or update)
- Helps identify stale records
- Useful for incremental syncs

**Query Examples:**
```sql
-- Find students not synced in last 6 months
SELECT * FROM students 
WHERE last_synced_at < NOW() - INTERVAL '6 months';

-- Find recently synced students
SELECT * FROM students 
WHERE last_synced_at > NOW() - INTERVAL '1 day'
ORDER BY last_synced_at DESC;
```

---

### 4. Stable Student UID ✅

**Purpose:** Stable internal identifier independent of `roll_no` and `clerk_id`

**Problem Solved:**
- Roll numbers can change (rare but possible)
- `clerk_id` is external to our system (depends on Clerk)
- Need stable UUID for external integrations

**Implementation:**
```typescript
// In schema.ts
student_uid: uuid("student_uid").defaultRandom().notNull().unique()
```

**Benefits:**
- **Stable:** Never changes once assigned
- **Universal:** Can be used across systems
- **Independent:** Not tied to Clerk or internal IDs
- **Unique:** Guaranteed unique constraint

**Usage:**
```typescript
// Reference student by UID in external APIs
GET /api/students/:student_uid

// Use in integrations
{
  "student_uid": "550e8400-e29b-41d4-a716-446655440000",
  "roll_no": "24BCS10005",
  "name": "John Doe"
}
```

---

### 5. Auto Data Cleaning on CSV Import ✅

**Purpose:** Normalize and clean data before inserting to maintain data quality

**Cleaning Functions:**

#### Email Cleaning
```typescript
function cleanEmail(email: string): string {
  return email.trim().toLowerCase();
}
```
**Examples:**
- `" John@Example.COM "` → `"john@example.com"`
- `"Student@UNIVERSITY.in "` → `"student@university.in"`

#### Name Capitalization
```typescript
function cleanFullName(name: string): string {
  return name.trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
```
**Examples:**
- `"JOHN DOE"` → `"John Doe"`
- `"mary jane watson"` → `"Mary Jane Watson"`
- `"  ravi   kumar  "` → `"Ravi Kumar"`

#### Hostel Normalization
```typescript
function normalizeHostel(hostel: string): "Neeladri" | "Velankani" | null {
  const cleaned = hostel.trim().toLowerCase();
  if (cleaned === "neeladri") return "Neeladri";
  if (cleaned === "velankani") return "Velankani";
  return null;
}
```
**Examples:**
- `"NEELADRI"` → `"Neeladri"`
- `"velankani"` → `"Velankani"`
- `" Neeladri "` → `"Neeladri"`
- `"invalid"` → `null` (validation error)

#### Class Section Normalization
```typescript
function normalizeClassSection(section: string): "A" | "B" | "C" | "D" | null {
  const cleaned = section.trim().toUpperCase();
  if (["A", "B", "C", "D"].includes(cleaned)) {
    return cleaned as "A" | "B" | "C" | "D";
  }
  return null;
}
```
**Examples:**
- `"a"` → `"A"`
- `" b "` → `"B"`
- `"d"` → `"D"`
- `"E"` → `null` (validation error)

#### Mobile Cleaning
```typescript
function cleanMobile(mobile: string): string {
  return mobile.replace(/\D/g, ""); // Remove all non-digits
}
```
**Examples:**
- `"98765-43210"` → `"9876543210"`
- `"(987) 654-3210"` → `"9876543210"`
- `"+91 98765 43210"` → `"919876543210"`

---

## Database Migration

**Migration File:** `scripts/migration-add-student-tracking-fields.sql`

**Steps:**
1. Add 4 new columns to `students` table
2. Add unique constraint on `student_uid`
3. Create indexes for performance
4. Backfill existing records:
   - Generate UUIDs for existing students
   - Set `source = 'manual'` for existing records
   - Set `last_synced_at = updated_at`

**Run Migration:**
```bash
# Using psql
psql -U your_user -d your_database -f scripts/migration-add-student-tracking-fields.sql

# Or via Drizzle
pnpm drizzle-kit push
```

**Verification Query:**
```sql
SELECT 
  COUNT(*) as total,
  COUNT(student_uid) as with_uid,
  COUNT(CASE WHEN active = true THEN 1 END) as active,
  COUNT(CASE WHEN active = false THEN 1 END) as inactive,
  COUNT(source) as with_source
FROM students;
```

---

## Updated CSV Upload Behavior

### Before Enhancement
```typescript
// Direct insert without cleaning
await db.insert(students).values({
  roll_no: row.user_number,  // No trimming
  hostel: row.hostel,         // Case-sensitive
  class_section: row.class_section, // No normalization
});
```

### After Enhancement
```typescript
// Clean data before insert
const cleanedData = {
  email: cleanEmail(row.email),                    // Trim + lowercase
  full_name: cleanFullName(row.full_name),         // Capitalize words
  user_number: row.user_number.trim(),             // Trim
  hostel: normalizeHostel(row.hostel),             // Neeladri/Velankani
  class_section: normalizeClassSection(row.class_section), // A/B/C/D
  mobile: cleanMobile(row.mobile),                 // Remove non-digits
};

await db.insert(students).values({
  ...cleanedData,
  source: "csv",              // Track source
  last_synced_at: new Date(), // Track sync time
  active: true,               // Default active
});
```

---

## API Changes

### Bulk Upload Endpoint Enhanced

**Endpoint:** `POST /api/superadmin/students/bulk-upload`

**New Behavior:**
1. ✅ Clean all incoming data (trim, capitalize, normalize)
2. ✅ Set `source = "csv"` for all uploads
3. ✅ Set `last_synced_at = NOW()` on create/update
4. ✅ Set `active = true` for new students (default)
5. ✅ Validate after cleaning (better error messages)

**Example Response:**
```json
{
  "success": true,
  "created": 50,
  "updated": 30,
  "skipped": 2,
  "errors": [
    {
      "row": 15,
      "field": "hostel",
      "message": "Hostel must be 'Neeladri' or 'Velankani' (case-insensitive)",
      "value": "invalid_hostel"
    }
  ],
  "summary": "Created: 50, Updated: 30, Skipped: 2"
}
```

---

## Future Enhancements

### 1. Active Status Management UI
**Location:** `/superadmin/students/:id/edit`

**Features:**
- Toggle active/inactive status
- Reason dropdown (Graduated, Expelled, On Leave, Other)
- Date of status change
- Comments/notes field

### 2. Bulk Status Updates
**Location:** `/superadmin/students/bulk-update-status`

**Features:**
- Select multiple students
- Change status in bulk
- Example: Mark entire 2024 batch as inactive (graduated)

### 3. Sync History Log
**Table:** `student_sync_history`

**Schema:**
```sql
CREATE TABLE student_sync_history (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES students(id),
  source VARCHAR(20),
  action VARCHAR(20), -- 'create' | 'update' | 'delete'
  changed_fields JSONB,
  synced_by UUID REFERENCES users(id),
  synced_at TIMESTAMP DEFAULT NOW()
);
```

### 4. Data Quality Dashboard
**Location:** `/superadmin/data-quality`

**Metrics:**
- Students missing hostel/room/mobile
- Duplicate roll numbers
- Inactive students still creating tickets
- Records not synced in 6+ months
- Data quality score by source

### 5. Smart Duplicate Detection
**Feature:** Detect potential duplicates during CSV upload

**Logic:**
- Same name + similar roll number
- Same email but different roll number
- Same mobile number

### 6. Incremental CSV Updates
**Feature:** Upload only changed records

**CSV Format:**
```csv
action,email,full_name,user_number,...
update,john@example.com,John Doe Updated,24BCS001
delete,jane@example.com,,,
create,new@example.com,New Student,24BCS100
```

---

## Schema Summary

**Updated `students` Table:**
```typescript
{
  // Existing fields
  id: serial,
  user_id: uuid,
  roll_no: varchar(32),
  room_no: varchar(16),
  hostel: enum,
  class_section: enum,
  batch_year: integer,
  department: varchar(120),
  tickets_this_week: integer,
  last_ticket_date: timestamp,
  created_at: timestamp,
  updated_at: timestamp,
  
  // NEW FIELDS
  student_uid: uuid (unique, stable identifier),
  active: boolean (default true),
  source: varchar(20) (default 'csv'),
  last_synced_at: timestamp,
}
```

**Indexes:**
- `idx_students_active` on `active`
- `idx_students_student_uid` on `student_uid`
- (Existing indexes remain)

---

## Testing Checklist

### Data Cleaning Tests
- [ ] Upload CSV with mixed case names → verify capitalized
- [ ] Upload CSV with spaces in emails → verify trimmed
- [ ] Upload CSV with lowercase hostels → verify normalized
- [ ] Upload CSV with lowercase sections → verify uppercase
- [ ] Upload CSV with formatted phone numbers → verify digits only

### Tracking Tests
- [ ] Create student via CSV → verify `source = 'csv'`
- [ ] Verify `last_synced_at` set on creation
- [ ] Update student via CSV → verify `last_synced_at` updated
- [ ] New student → verify `active = true`
- [ ] All students have unique `student_uid`

### Edge Cases
- [ ] Empty optional fields → verify `null` stored
- [ ] Update existing student → verify fields properly overwritten
- [ ] Invalid hostel after normalization → verify error
- [ ] Invalid section after normalization → verify error

---

## Migration Rollback (If Needed)

```sql
-- Remove new columns
ALTER TABLE students 
  DROP COLUMN IF EXISTS student_uid,
  DROP COLUMN IF EXISTS active,
  DROP COLUMN IF EXISTS source,
  DROP COLUMN IF EXISTS last_synced_at;

-- Drop indexes
DROP INDEX IF EXISTS idx_students_active;
DROP INDEX IF EXISTS idx_students_student_uid;
```

---

## Success Metrics

✅ **4 New Tracking Fields Added**
- `student_uid` - Stable UUID identifier
- `active` - Lifecycle status flag
- `source` - Data origin tracking
- `last_synced_at` - Sync timestamp

✅ **5 Data Cleaning Functions Implemented**
- Email cleaning (trim + lowercase)
- Name capitalization (proper case)
- Hostel normalization (case-insensitive)
- Class section normalization (uppercase)
- Mobile cleaning (digits only)

✅ **Migration SQL Created**
- Adds columns with proper defaults
- Backfills existing records
- Creates necessary indexes

✅ **CSV Upload Enhanced**
- All data cleaned before validation
- Source and sync time tracked
- Better error messages (after cleaning)

---

**Status:** 100% Complete
**Migration Ready:** Yes
**Backward Compatible:** Yes (all new fields have defaults)
