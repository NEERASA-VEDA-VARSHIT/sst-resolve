-- Seed initial ticket statuses
-- Run this SQL in your PostgreSQL database or via a database client

INSERT INTO ticket_statuses (
  value, 
  label, 
  description, 
  progress_percent, 
  badge_color, 
  is_active, 
  is_final, 
  display_order
) VALUES
  ('OPEN', 'Open', 'New ticket, not yet assigned', 10, 'default', true, false, 1),
  ('IN_PROGRESS', 'In Progress', 'POC is actively working on the ticket', 50, 'secondary', true, false, 2),
  ('AWAITING_STUDENT', 'Awaiting Student', 'Waiting for student response', 70, 'outline', true, false, 3),
  ('REOPENED', 'Reopened', 'Ticket was reopened by student', 30, 'destructive', true, false, 4),
  ('ESCALATED', 'Escalated', 'Ticket has been escalated', 60, 'destructive', true, false, 5),
  ('RESOLVED', 'Resolved', 'Ticket has been resolved', 100, 'default', true, true, 6)
ON CONFLICT (value) DO NOTHING;

-- Verify insertion
SELECT * FROM ticket_statuses ORDER BY display_order;
