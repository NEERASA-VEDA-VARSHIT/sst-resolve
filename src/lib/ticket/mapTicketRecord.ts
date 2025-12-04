/**
 * Map ticket database record to TicketCard-compatible format
 */

type TicketRow = {
  id: number;
  title: string | null;
  description: string | null;
  location: string | null;
  scope_id?: number | null;
  scope_name?: string | null;
  status_id: number | null;
  status_value: string | null;
  category_id: number | null;
  subcategory_id: number | null;
  sub_subcategory_id: number | null;
  created_by: string | null;
  assigned_to: string | null;
  group_id: number | null;
  escalation_level: number | null;
  acknowledgement_due_at: Date | null;
  resolution_due_at: Date | null;
  metadata: unknown;
  created_at: Date | null;
  updated_at: Date | null;
  category_name: string | null;
  creator_full_name?: string | null;
  creator_email?: string | null;
};

export function mapTicketRecord(row: TicketRow) {
  // Filter out rows with null created_by
  if (!row.created_by) {
    throw new Error('Cannot map ticket record with null created_by');
  }

  let ticketMetadata: Record<string, unknown> = {};
  if (row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)) {
    ticketMetadata = row.metadata as Record<string, unknown>;
  }

  return {
    ...row,
    created_by: row.created_by, // Now guaranteed to be string
    status: row.status_value || null,
    status_id: row.status_id || null,
    scope_id: null,
    category_name: row.category_name || null,
    creator_name: row.creator_full_name || null,
    creator_email: row.creator_email || null,
    resolved_at: ticketMetadata.resolved_at ? new Date(ticketMetadata.resolved_at as string) : null,
    reopened_at: ticketMetadata.reopened_at ? new Date(ticketMetadata.reopened_at as string) : null,
    acknowledged_at: ticketMetadata.acknowledged_at ? new Date(ticketMetadata.acknowledged_at as string) : null,
    rating: (ticketMetadata.rating as number | null) || null,
    feedback: (ticketMetadata.feedback as string | null) || null,
  };
}
