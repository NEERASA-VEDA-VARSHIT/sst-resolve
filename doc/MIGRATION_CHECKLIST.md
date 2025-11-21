# Migration Checklist: Legacy to CSV-Based Profile System

## Database Migration

### 1. Add student_profile_fields Table
```sql
-- Run this migration to add the profile fields configuration table

CREATE TABLE IF NOT EXISTS student_profile_fields (
  id SERIAL PRIMARY KEY,
  field_name VARCHAR(100) NOT NULL UNIQUE,
  field_label VARCHAR(200) NOT NULL,
  field_type VARCHAR(50) NOT NULL, -- text, number, select, date, email, tel
  is_required BOOLEAN DEFAULT false,
  is_editable_by_student BOOLEAN DEFAULT false,
  is_system_field BOOLEAN DEFAULT false, -- true for core fields like email, user_number
  display_order INTEGER DEFAULT 0,
  validation_rules JSONB, -- e.g., {"min": 10, "max": 10, "pattern": "^\\d+$"}
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add index for efficient lookups
CREATE INDEX idx_student_profile_fields_order ON student_profile_fields(display_order);

-- Insert default field definitions
INSERT INTO student_profile_fields (field_name, field_label, field_type, is_required, is_editable_by_student, is_system_field, display_order) VALUES
  ('user_number', 'Roll Number', 'text', true, false, true, 1),
  ('full_name', 'Full Name', 'text', true, false, true, 2),
  ('email', 'Email Address', 'email', true, false, true, 3),
  ('hostel', 'Hostel', 'select', true, false, false, 4),
  ('room_number', 'Room Number', 'text', false, false, false, 5),
  ('class_section', 'Class Section', 'select', false, false, false, 6),
  ('batch_year', 'Batch Year', 'number', false, false, false, 7),
  ('mobile', 'Mobile Number', 'tel', false, true, false, 8),
  ('department', 'Department', 'text', false, false, false, 9);

-- Update validation rules for mobile field
UPDATE student_profile_fields 
SET validation_rules = '{"min": 10, "max": 10, "pattern": "^\\d{10}$"}'
WHERE field_name = 'mobile';
```

**Status:** ⬜ Not run yet

---

## Code Deployment Checklist

### 2. Verify New Files Created
- [ ] `src/app/api/superadmin/students/bulk-upload/route.ts`
- [ ] `src/app/api/superadmin/students/template/route.ts`
- [ ] `src/app/api/superadmin/students/route.ts`
- [ ] `src/components/admin/StudentBulkUpload.tsx`
- [ ] `src/app/(app)/superadmin/students/page.tsx`
- [ ] `src/components/ui/table.tsx`

### 3. Verify Modified Files
- [ ] `src/lib/user-sync.ts` (security fixes + auto-linking)
- [ ] `src/db/schema.ts` (student_profile_fields table)
- [ ] `src/app/(app)/student/profile/page.tsx` (readonly UI)
- [ ] `src/app/api/profile/route.ts` (mobile-only PATCH)
- [ ] `src/lib/profile-check.ts` (simplified)
- [ ] `src/schema/student.schema.ts` (mobile schema + deprecated marks)
- [ ] `src/schema/index.ts` (updated exports)

### 4. Run TypeScript Compile Check
```powershell
pnpm run build
```
**Expected:** No compile errors

**Status:** ⬜ Not run yet

---

## Data Migration (Optional)

### 5. Migrate Existing Students to CSV Format

If you have existing students in the database:

```sql
-- Export existing students to CSV
COPY (
  SELECT 
    u.email,
    u.name as full_name,
    s.roll_no as user_number,
    s.hostel,
    s.room_no as room_number,
    s.class_section,
    s.batch_year,
    u.phone as mobile,
    s.department
  FROM students s
  JOIN users u ON s.user_id = u.id
  WHERE u.clerk_id NOT LIKE 'pending_%'
  ORDER BY s.batch_year DESC, s.roll_no ASC
) TO '/path/to/existing_students.csv' WITH CSV HEADER;
```

Then:
1. Review exported CSV for data quality
2. Upload via SuperAdmin interface to verify
3. System will update existing records by email

**Status:** ⬜ Not needed (no existing students) OR ⬜ Completed

---

## Testing

### 6. SuperAdmin Upload Flow
- [ ] Login as SuperAdmin
- [ ] Navigate to `/superadmin/students`
- [ ] Download CSV template
- [ ] Fill template with 3-5 test students
- [ ] Upload CSV
- [ ] Verify success message shows created count
- [ ] Verify students appear in list

### 7. CSV Validation
- [ ] Upload CSV with invalid email → verify error shown
- [ ] Upload CSV with invalid hostel → verify error shown
- [ ] Upload CSV with 9-digit mobile → verify error shown
- [ ] Upload CSV with duplicate emails → verify update (not duplicate)

### 8. Student Auto-Linking
- [ ] Upload CSV with `test@example.com`
- [ ] Check database: `SELECT clerk_id FROM users WHERE email = 'test@example.com'`
- [ ] Expected: `clerk_id = 'pending_test@example.com'`
- [ ] Login with `test@example.com` in Clerk
- [ ] Check database again
- [ ] Expected: `clerk_id = 'user_2abc123xyz'` (real Clerk ID)

### 9. Student Profile View
- [ ] Login as student with existing profile
- [ ] Navigate to `/student/profile`
- [ ] Verify all fields readonly (disabled inputs with Lock icons)
- [ ] Verify admin notice banner shows
- [ ] Verify mobile number field is editable

### 10. Mobile Number Update
- [ ] Update mobile to valid 10-digit number
- [ ] Submit form
- [ ] Verify success message
- [ ] Verify mobile updated in database
- [ ] Try invalid mobile (9 digits) → verify error

### 11. Search and Filter
- [ ] Search by student name → verify results
- [ ] Search by email → verify results
- [ ] Search by roll number → verify results
- [ ] Filter by hostel → verify filtered list
- [ ] Filter by batch year → verify filtered list
- [ ] Test pagination with 50+ students

---

## Rollback Plan (If Needed)

### If Issues Are Found:

1. **Revert Code Changes**
   ```powershell
   git revert <commit-hash>
   ```

2. **Drop New Table** (if migration was run)
   ```sql
   DROP TABLE IF EXISTS student_profile_fields;
   ```

3. **Restore Legacy Profile Code**
   - Git checkout previous version of:
     - `src/app/(app)/student/profile/page.tsx`
     - `src/app/api/profile/route.ts`
     - `src/lib/profile-check.ts`

---

## Post-Deployment Tasks

### 12. Update Documentation
- [ ] Add CSV upload instructions to admin guide
- [ ] Document auto-linking behavior for support team
- [ ] Update student onboarding docs (profiles are pre-created)

### 13. Monitor Logs
- [ ] Check for errors in CSV upload endpoint
- [ ] Check for auto-linking errors in user-sync
- [ ] Check for mobile update failures

### 14. Communicate Changes
- [ ] Notify admins about new CSV upload feature
- [ ] Notify students that profiles are pre-filled
- [ ] Notify support team about "Contact Administration" for missing profiles

---

## Security Review

### 15. Verify Security Fixes
- [ ] Email validation: Check `user-sync.ts` line 48-50
- [ ] Name normalization: Check `getClerkDisplayName()` function
- [ ] Admin role override: Check line 75-77 in `user-sync.ts`
- [ ] Auto-linking: Check `getOrCreateUser()` function

### 16. Permission Checks
- [ ] SuperAdmin routes: Only accessible to superadmin role
- [ ] Student profile: Only accessible to authenticated students
- [ ] CSV upload: Only accessible to superadmin
- [ ] Mobile update: Students can only update their own

---

## Performance Testing

### 17. Load Testing
- [ ] Upload CSV with 1000+ students
- [ ] Verify import completes within reasonable time
- [ ] Check database performance during bulk insert
- [ ] Test pagination with large dataset (5000+ students)

---

## Success Criteria

All tasks must be ✅ before considering migration complete:

- [ ] Database migration successful
- [ ] TypeScript compiles without errors
- [ ] CSV upload creates students
- [ ] Auto-linking works on first login
- [ ] Student profile is readonly (except mobile)
- [ ] Search/filter works correctly
- [ ] Mobile updates work
- [ ] No security vulnerabilities
- [ ] Documentation updated

---

## Notes

### Current Status
- ✅ Code changes complete
- ⬜ Database migration pending
- ⬜ Testing pending
- ⬜ Deployment pending

### Known Issues
- None currently

### Future Enhancements
1. Profile Fields Manager UI (optional)
2. Bulk export to CSV
3. Student activity logs
4. Field-level permissions

---

**Last Updated:** 2024-01-15
**Migration Owner:** SuperAdmin
**Estimated Time:** 2-4 hours (including testing)
