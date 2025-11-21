/**
 * Type definitions for database structures
 * PRD v3.0 - Updated for new normalized schema
 */

/**
 * Ticket Metadata JSON structure
 * Stored in ticket.metadata as JSON
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
		extendedBy: string; // Clerk userId or users.id
	}>;

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

	// Comments (stored in metadata for backward compatibility)
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
}

/**
 * Attachment structure stored in ticket.attachments JSON array
 */
export interface TicketAttachment {
	url: string;
	storage_key?: string;
	mime?: string;
	size?: number;
	filename?: string;
}

/**
 * Comment structure (now in separate comments table)
 * Kept for backward compatibility and type reference
 */
export interface TicketComment {
	id?: number;
	ticket_id: number;
	author_id: string;
	body: string;
	comment_type?: "student_visible" | "internal_note" | "super_admin_note";
	is_internal?: boolean;
	slack_message_id?: string;
	created_at?: string; // ISO timestamp
}

/**
 * Escalation record (now in separate escalations table)
 */
export interface EscalationRecord {
	id?: number;
	ticket_id: number;
	escalated_by?: string;
	escalated_to?: string; // users.id
	reason?: string;
	level: number;
	created_at?: string; // ISO timestamp
}

/**
 * Activity log entry (now in separate activity_logs table)
 */
export interface ActivityLog {
	id?: number;
	ticket_id?: number;
	user_id?: string;
	action: string; // 'create_ticket','assign','status_change','escalate','reopen'
	details?: Record<string, any>; // old/new values, extra context
	created_at?: string; // ISO timestamp
}

/**
 * Parse ticket metadata JSON string to TicketMetadata object
 */
export function parseTicketMetadata(metadata: any): TicketMetadata {
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

/**
 * Stringify TicketMetadata object to JSON string
 */
export function stringifyTicketMetadata(metadata: TicketMetadata): string {
	return JSON.stringify(metadata);
}

/**
 * Parse attachments JSON array
 */
export function parseAttachments(attachments: any): TicketAttachment[] {
	if (!attachments) return [];
	if (typeof attachments === "string") {
		try {
			return JSON.parse(attachments) as TicketAttachment[];
		} catch (e) {
			console.error("Error parsing attachments:", e);
			return [];
		}
	}
	return Array.isArray(attachments) ? attachments : [];
}
