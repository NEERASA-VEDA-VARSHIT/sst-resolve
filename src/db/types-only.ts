// Client-safe type exports only
// This file exports only types, no runtime code
// Use this for type-only imports in client components
// 
// IMPORTANT: This file does NOT import from ./schema to avoid pulling in
// server-only dependencies (drizzle-orm, postgres, etc.)

/**
 * Ticket type definition (client-safe)
 * This matches the database schema but is defined manually to avoid
 * importing server-only code in client components
 */
export interface Ticket {
	id: number;
	title: string | null;
	description: string | null;
	location: string | null;
	status_id: number;
	category_id: number | null;
	subcategory_id: number | null;
	sub_subcategory_id: number | null;
	created_by: string;
	assigned_to: string | null;
	acknowledged_by: string | null;
	group_id: number | null;
	escalation_level: number;
	tat_extended_count: number;
	last_escalation_at: Date | null;
	acknowledgement_tat_hours: number | null;
	resolution_tat_hours: number | null;
	acknowledgement_due_at: Date | null;
	resolution_due_at: Date | null;
	acknowledged_at: Date | null;
	reopened_at: Date | null;
	sla_breached_at: Date | null;
	reopen_count: number;
	rating: number | null;
	feedback_type: string | null;
	rating_submitted: Date | null;
	feedback: string | null;
	is_public: boolean | null;
	admin_link: string | null;
	student_link: string | null;
	slack_thread_id: string | null;
	external_ref: string | null;
	metadata: unknown; // JSONB - parsed as TicketMetadata in components
	created_at: Date | null;
	updated_at: Date | null;
	resolved_at: Date | null;
}
