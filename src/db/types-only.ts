// Client-safe type exports only
// This file exports only types, no runtime code
// Use this for type-only imports in client components
// 
// IMPORTANT: This file does NOT import from ./schema or ./inferred-types
// to avoid pulling in server-only dependencies (drizzle-orm, postgres, etc.)
//
// For server components, use @/db/inferred-types instead (includes TicketMetadata)

/**
 * Ticket type definition (client-safe)
 * This matches the database schema but is defined manually to avoid
 * importing server-only code in client components
 * 
 * Updated to match the new schema structure
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
	scope_id: number | null;
	created_by: string | null; // UUID
	assigned_to: string | null; // UUID
	escalation_level: number;
	acknowledgement_due_at: Date | null;
	resolution_due_at: Date | null;
	metadata: unknown; // JSONB - parsed as TicketMetadata in components
	created_at: Date | null;
	updated_at: Date | null;
}

/**
 * Student Profile Type (API Response)
 * 
 * This type matches the response from /api/profile
 * The API transforms data from multiple tables (students, users, hostels, etc.)
 * 
 * NOTE: This is the transformed shape, not the raw database schema.
 * The actual database has separate tables: students, users, hostels, batches, class_sections
 */
export interface StudentProfile {
	id: number;
	user_number: string;
	full_name: string;
	email: string;
	room_number: string | null;
	mobile: string | null;
	hostel: string | null;
	hostel_id: number | null;
	class_section: string | null;
	batch_year: number | null;
	department: string | null;
	created_at: string;
	updated_at: string;
}

/**
 * Hostel Type (API Response)
 * 
 * This type matches the response from /api/superadmin/hostels
 */
export interface Hostel {
	id: number;
	name: string;
	is_active?: boolean;
	created_at: string;
}

/**
 * Class Section Type (API Response)
 * 
 * This type matches the response from /api/superadmin/class-sections
 */
export interface ClassSection {
	id: number;
	name: string;
	created_at: string;
}

/**
 * Batch Type (API Response)
 * 
 * This type matches the response from /api/superadmin/batches
 */
export interface Batch {
	id: number;
	batch_year: number;
	is_active?: boolean;
	created_at: string;
}

/**
 * Ticket Metadata JSON structure (client-safe)
 * Stored in ticket.metadata as JSONB
 * 
 * NOTE: This is a duplicate of the interface in inferred-types.ts
 * but kept here for client components that can't import server-only code
 */
export interface TicketMetadata {
	// TAT (Turnaround Time) information
	tat?: string;
	tatDate?: string;
	tatSetAt?: string;
	tatSetBy?: string;

	// TAT Extension tracking
	tatExtensions?: Array<{
		previousTAT: string;
		newTAT: string;
		previousTATDate: string;
		newTATDate: string;
		extendedAt: string;
		extendedBy: string;
	}>;

	// TAT Pause/Resume tracking
	tatPauseStart?: string;
	tatPausedDuration?: number;

	// Email threading
	originalEmailMessageId?: string;
	originalEmailSubject?: string;

	// Slack integration (legacy)
	slackMessageTs?: string;
	slackChannel?: string;

	// Last reminder date
	lastReminderDate?: string;

	// Browser/device info
	browser?: string;
	device?: string;
	userAgent?: string;

	// Comments (legacy - now stored in ticket_activity table)
	comments?: Array<{
		text: string;
		author: string;
		createdAt: string;
		source?: string;
		type?: string;
		isInternal?: boolean;
	}>;

	// Images
	images?: string[];

	// Subcategory
	subcategory?: string;
}