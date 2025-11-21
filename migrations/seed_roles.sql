-- ============================================================================
-- SEED DATA: Initial Roles
-- ============================================================================

INSERT INTO roles (name, description) VALUES
  ('student', 'Regular student user - can create and view their own tickets'),
  ('admin', 'Department/domain administrator - manages tickets in specific domains'),
  ('super_admin', 'System administrator - full access to all system features'),
  ('committee_head', 'Committee chairperson - oversees committee-assigned tickets')
ON CONFLICT (name) DO NOTHING;
