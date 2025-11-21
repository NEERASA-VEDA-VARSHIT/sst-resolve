-- Update student details for Roll No: 24bcs10005
-- Name: Neerasa Vedavarshit
-- Phone: 9391541081

-- First, find the user_id associated with this student
-- Then update the users table with the correct name and phone

UPDATE users
SET 
  first_name = 'Neerasa',
  last_name = 'Vedavarshit',
  phone = '9391541081',
  updated_at = NOW()
WHERE id = (
  SELECT user_id 
  FROM students 
  WHERE roll_no = '24bcs10005'
  LIMIT 1
);

-- Verify the update
SELECT 
  s.id AS student_id,
  s.roll_no,
  u.email,
  u.first_name,
  u.last_name,
  u.phone,
  s.room_no,
  h.name AS hostel,
  cs.name AS section,
  b.batch_year
FROM students s
JOIN users u ON s.user_id = u.id
LEFT JOIN hostels h ON s.hostel_id = h.id
LEFT JOIN class_sections cs ON s.class_section_id = cs.id
LEFT JOIN batches b ON s.batch_id = b.id
WHERE s.roll_no = '24bcs10005';
