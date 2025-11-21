-- ============================================================================
-- SEED DATA: Ticket Statuses
-- ============================================================================

INSERT INTO ticket_statuses (
  value, label, description, badge_color, is_final, progress_percent, display_order, is_active
) VALUES
  ('OPEN', 'Open', 'New ticket, awaiting assignment', 'default', false, 0, 1, true),
  ('IN_PROGRESS', 'In Progress', 'Admin is actively working on this ticket', 'outline', false, 40, 2, true),
  ('AWAITING_STUDENT', 'Awaiting Student', 'Waiting for student response', 'outline', false, 50, 3, true),
  ('REOPENED', 'Reopened', 'Student reopened a resolved ticket', 'default', false, 10, 4, true),
  ('ESCALATED', 'Escalated', 'Ticket escalated to higher authority', 'destructive', false, 60, 5, true),
  ('FORWARDED', 'Forwarded', 'Ticket forwarded to another admin', 'secondary', false, 30, 6, true),
  ('RESOLVED', 'Resolved', 'Ticket successfully resolved', 'secondary', true, 100, 7, true)
ON CONFLICT (value) DO NOTHING;
