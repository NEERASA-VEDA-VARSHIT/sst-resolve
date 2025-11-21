-- Update student name for Roll No: 24bcs10005
-- Name: Neerasa Vedavarshit

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

-- Verify the update
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

