/**
 * Drizzle-Inferred Types
 * 
 * This file exports TypeScript types automatically inferred from Drizzle table schemas.
 * These types are the single source of truth for database row shapes.
 * 
 * Usage:
 *   - Use `StudentSelect` when reading from `students` table
 *   - Use `StudentInsert` when inserting into `students` table
 *   - Use `TicketSelect` when reading from `tickets` table
 *   - Use `TicketInsert` when inserting into `tickets` table
 * 
 * Benefits:
 *   - Types automatically stay in sync with schema changes
 *   - No manual type maintenance required
 *   - Full type safety for database operations
 */

import {
  admin_profiles,
  students,
  users,
  tickets,
  hostels,
  categories,
  subcategories,
  ticket_feedback,
  ticket_integrations,
  ticket_activity,
  roles,
  domains,
  scopes,
  batches,
  class_sections,
  admin_assignments,
  category_assignments,
  category_fields,
  field_options,
  ticket_statuses,
  ticket_attachments,
  ticket_committee_tags,
  committees,
  notifications,
  escalation_rules,
} from "./schema";

// ============================================================================
// STUDENTS
// ============================================================================
export type StudentSelect = typeof students.$inferSelect;
export type StudentInsert = typeof students.$inferInsert;

// ============================================================================
// USERS
// ============================================================================
export type UserSelect = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;

// ============================================================================
// TICKETS
// ============================================================================
export type TicketSelect = typeof tickets.$inferSelect;
export type TicketInsert = typeof tickets.$inferInsert;

// ============================================================================
// HOSTELS
// ============================================================================
export type HostelSelect = typeof hostels.$inferSelect;
export type HostelInsert = typeof hostels.$inferInsert;

// ============================================================================
// CATEGORIES
// ============================================================================
export type CategorySelect = typeof categories.$inferSelect;
export type CategoryInsert = typeof categories.$inferInsert;

export type SubcategorySelect = typeof subcategories.$inferSelect;
export type SubcategoryInsert = typeof subcategories.$inferInsert;


// ============================================================================
// TICKET ACTIVITY (replaces comments)
// ============================================================================
export type TicketActivitySelect = typeof ticket_activity.$inferSelect;
export type TicketActivityInsert = typeof ticket_activity.$inferInsert;

// ============================================================================
// TICKET FEEDBACK & INTEGRATIONS
// ============================================================================
export type TicketFeedbackSelect = typeof ticket_feedback.$inferSelect;
export type TicketFeedbackInsert = typeof ticket_feedback.$inferInsert;

export type TicketIntegrationSelect = typeof ticket_integrations.$inferSelect;
export type TicketIntegrationInsert = typeof ticket_integrations.$inferInsert;

// ============================================================================
// ROLES
// ============================================================================
export type RoleSelect = typeof roles.$inferSelect;
export type RoleInsert = typeof roles.$inferInsert;

// ============================================================================
// DOMAINS & SCOPES
// ============================================================================
export type DomainSelect = typeof domains.$inferSelect;
export type DomainInsert = typeof domains.$inferInsert;

export type ScopeSelect = typeof scopes.$inferSelect;
export type ScopeInsert = typeof scopes.$inferInsert;

// ============================================================================
// BATCHES & CLASS SECTIONS
// ============================================================================
export type BatchSelect = typeof batches.$inferSelect;
export type BatchInsert = typeof batches.$inferInsert;

export type ClassSectionSelect = typeof class_sections.$inferSelect;
export type ClassSectionInsert = typeof class_sections.$inferInsert;

// ============================================================================
// ADMIN PROFILES & ASSIGNMENTS
// ============================================================================
export type AdminProfileSelect = typeof admin_profiles.$inferSelect;
export type AdminProfileInsert = typeof admin_profiles.$inferInsert;

export type AdminAssignmentSelect = typeof admin_assignments.$inferSelect;
export type AdminAssignmentInsert = typeof admin_assignments.$inferInsert;

// ============================================================================
// CATEGORY ASSIGNMENTS & FIELDS
// ============================================================================
export type CategoryAssignmentSelect = typeof category_assignments.$inferSelect;
export type CategoryAssignmentInsert = typeof category_assignments.$inferInsert;

export type CategoryFieldSelect = typeof category_fields.$inferSelect;
export type CategoryFieldInsert = typeof category_fields.$inferInsert;

export type FieldOptionSelect = typeof field_options.$inferSelect;
export type FieldOptionInsert = typeof field_options.$inferInsert;

// ============================================================================
// TICKET STATUSES & ATTACHMENTS
// ============================================================================
export type TicketStatusSelect = typeof ticket_statuses.$inferSelect;
export type TicketStatusInsert = typeof ticket_statuses.$inferInsert;

export type TicketAttachmentSelect = typeof ticket_attachments.$inferSelect;
export type TicketAttachmentInsert = typeof ticket_attachments.$inferInsert;

export type TicketCommitteeTagSelect = typeof ticket_committee_tags.$inferSelect;
export type TicketCommitteeTagInsert = typeof ticket_committee_tags.$inferInsert;

// ============================================================================
// COMMITTEES
// ============================================================================
export type CommitteeSelect = typeof committees.$inferSelect;
export type CommitteeInsert = typeof committees.$inferInsert;

// ============================================================================
// NOTIFICATIONS & ESCALATION
// ============================================================================
export type NotificationSelect = typeof notifications.$inferSelect;
export type NotificationInsert = typeof notifications.$inferInsert;

export type EscalationRuleSelect = typeof escalation_rules.$inferSelect;
export type EscalationRuleInsert = typeof escalation_rules.$inferInsert;

// ============================================================================
// TICKET METADATA (JSONB structure in tickets.metadata)
// ============================================================================

/**
 * Ticket Metadata JSON structure
 * Stored in ticket.metadata as JSONB
 * Contains: TAT extensions, email threading, slack info, etc.
 */
export interface TicketMetadata {
	// TAT (Turnaround Time) information
	tat?: string; // e.g., "2 days", "1 week"
	tatDate?: string; // ISO timestamp
	tatSetAt?: string; // ISO timestamp
	tatSetBy?: string; // Admin name or userId

	// TAT Extension tracking (PRD v3.0: auto-escalate after 3 extensions)
	tatExtensions?: Array<{
		previousTAT: string;
		newTAT: string;
		previousTATDate: string; // ISO timestamp
		newTATDate: string; // ISO timestamp
		extendedAt: string; // ISO timestamp
		extendedBy: string; // User ID (UUID)
	}>;

	// TAT Pause/Resume tracking
	tatPauseStart?: string; // ISO timestamp - when TAT was paused (status changed to AWAITING_STUDENT)
	tatPausedDuration?: number; // Total paused duration in milliseconds (accumulated across multiple pauses)

	// Email threading
	originalEmailMessageId?: string; // For email threading
	originalEmailSubject?: string; // Original email subject

	// Slack integration (legacy - now in slack_thread_id field)
	slackMessageTs?: string; // Slack thread timestamp
	slackChannel?: string; // Slack channel name

	// Last reminder date (for TAT reminders)
	lastReminderDate?: string; // ISO timestamp

	// Browser/device info
	browser?: string;
	device?: string;
	userAgent?: string;

	// Comments (legacy - now stored in ticket_activity table)
	// Kept for backward compatibility with old ticket data
	comments?: Array<{
		text: string;
		author: string;
		createdAt: string; // ISO timestamp
		source?: string;
		type?: string;
		isInternal?: boolean;
	}>;

	// Images (stored in metadata)
	images?: string[];

	// Subcategory (stored in metadata)
	subcategory?: string;

	// Forwarding count (for "ping-pong" forwarding detection - Rule 5)
	forwardCount?: number;

	// Ticket lifecycle timestamps (moved from direct columns to metadata)
	resolved_at?: string; // ISO timestamp
	acknowledged_at?: string; // ISO timestamp
	reopened_at?: string; // ISO timestamp
	last_escalation_at?: string; // ISO timestamp
	sla_breached_at?: string; // ISO timestamp

	// Rating and feedback (moved from direct columns to metadata)
	rating?: number;
	rating_submitted?: string; // ISO timestamp
	feedback?: string;
	feedback_type?: string;

	// Reopen tracking
	reopen_count?: number;
}

/**
 * Parse ticket metadata JSON string to TicketMetadata object
 */
export function parseTicketMetadata(metadata: unknown): TicketMetadata {
	if (!metadata) return {};
	if (typeof metadata === "string") {
		try {
			return JSON.parse(metadata) as TicketMetadata;
		} catch (e) {
			console.error("Error parsing ticket metadata:", e);
			return {};
		}
	}
	return metadata as TicketMetadata;
}

