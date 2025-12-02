-- Performance indexes for frequently queried columns
-- This migration adds indexes to improve query performance on the tickets table

-- Index for sorting by created_at (most common sort)
CREATE INDEX IF NOT EXISTS idx_tickets_created_at_desc ON tickets(created_at DESC);

-- Index for assigned_to lookups (admin dashboard queries)
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to) WHERE assigned_to IS NOT NULL;

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_tickets_status_id ON tickets(status_id) WHERE status_id IS NOT NULL;

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_tickets_category_id ON tickets(category_id) WHERE category_id IS NOT NULL;

-- Index for group_id lookups
CREATE INDEX IF NOT EXISTS idx_tickets_group_id ON tickets(group_id) WHERE group_id IS NOT NULL;

-- Index for escalation level filtering
CREATE INDEX IF NOT EXISTS idx_tickets_escalation_level ON tickets(escalation_level) WHERE escalation_level > 0;

-- Index for resolution_due_at (TAT queries)
CREATE INDEX IF NOT EXISTS idx_tickets_resolution_due_at ON tickets(resolution_due_at) WHERE resolution_due_at IS NOT NULL;

-- Composite index for common filter combinations (assigned_to + status)
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_status ON tickets(assigned_to, status_id) WHERE assigned_to IS NOT NULL AND status_id IS NOT NULL;

-- Index for created_by (student dashboard queries)
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by) WHERE created_by IS NOT NULL;
