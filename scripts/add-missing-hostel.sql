-- ============================================================================
-- Add Missing Hostel
-- This script checks and adds the missing hostel (Neeladri or Velankani)
-- ============================================================================

-- Check existing hostels
SELECT id, name, code, is_active, created_at 
FROM hostels 
ORDER BY name;

-- Add Neeladri if it doesn't exist
INSERT INTO hostels (name, code, is_active)
SELECT 'Neeladri', 'NEL', true
WHERE NOT EXISTS (
  SELECT 1 FROM hostels WHERE LOWER(name) = LOWER('Neeladri')
);

-- Add Velankani if it doesn't exist
INSERT INTO hostels (name, code, is_active)
SELECT 'Velankani', 'VEL', true
WHERE NOT EXISTS (
  SELECT 1 FROM hostels WHERE LOWER(name) = LOWER('Velankani')
);

-- Verify the final count
SELECT 
  COUNT(*) as total_hostels,
  COUNT(*) FILTER (WHERE is_active = true) as active_hostels
FROM hostels;

-- Show all hostels
SELECT id, name, code, capacity, is_active, created_at 
FROM hostels 
ORDER BY name;

