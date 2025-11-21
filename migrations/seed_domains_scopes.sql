-- ============================================================================
-- SEED DATA: Default Domains & Scopes
-- ============================================================================

INSERT INTO domains (name, description, is_active) VALUES
  ('Hostel', 'Student hostel-related issues', true),
  ('General', 'General queries', true)
ON CONFLICT (name) DO NOTHING;

DO $$
DECLARE
  hostel_id INT;
BEGIN
  SELECT id INTO hostel_id FROM domains WHERE name = 'Hostel';

  INSERT INTO scopes (domain_id, name, description, is_active) VALUES
    (hostel_id, 'Neeladri', 'Neeladri Hostel', true),
    (hostel_id, 'Velankani', 'Velankani Hostel', true)
ON CONFLICT (domain_id, name) DO NOTHING;
END $$;
