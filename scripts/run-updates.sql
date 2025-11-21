-- ============================================================================
-- Run these SQL commands in your database to fix the issues
-- ============================================================================

-- 1. Seed ticket statuses (if not already seeded)
-- ============================================================================
INSERT INTO ticket_statuses (
  value, label, description, badge_color, is_final, progress_percent, display_order, is_active
) VALUES
  ('OPEN', 'Open', 'New ticket, awaiting assignment', 'default', false, 0, 1, true),
  ('IN_PROGRESS', 'In Progress', 'Admin is actively working on this ticket', 'outline', false, 40, 2, true),
  ('AWAITING_STUDENT_RESPONSE', 'Awaiting Student Response', 'Waiting for student response', 'outline', false, 50, 3, true),
  ('REOPENED', 'Reopened', 'Student reopened a resolved ticket', 'default', false, 10, 4, true),
  ('ESCALATED', 'Escalated', 'Ticket escalated to higher authority', 'destructive', false, 60, 5, true),
  ('FORWARDED', 'Forwarded', 'Ticket forwarded to another admin', 'secondary', false, 30, 6, true),
  ('RESOLVED', 'Resolved', 'Ticket successfully resolved', 'secondary', true, 100, 7, true)
ON CONFLICT (value) DO NOTHING;

-- 2. Update student name for Roll No: 24bcs10005
-- ============================================================================
UPDATE users
SET 
  first_name = 'Neerasa',
  last_name = 'Vedavarshit',
  updated_at = NOW()
WHERE id = (
  SELECT user_id 
  FROM students 
  WHERE roll_no = '24bcs10005'
  LIMIT 1
);

-- 3. Verify the updates
-- ============================================================================
-- Check ticket statuses
SELECT * FROM ticket_statuses ORDER BY display_order;

-- Check student name update
SELECT 
  s.id AS student_id,
  s.roll_no,
  u.email,
  u.first_name,
  u.last_name,
  CONCAT(u.first_name, ' ', u.last_name) AS full_name
FROM students s
JOIN users u ON s.user_id = u.id
WHERE s.roll_no = '24bcs10005';

