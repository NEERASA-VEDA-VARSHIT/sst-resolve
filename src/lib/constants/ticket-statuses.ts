/**
 * Ticket Status Constants and Metadata
 * 
 * This file contains all ticket status metadata that was previously
 * stored in the ticket_statuses table. Now it's in code for better
 * type safety and performance.
 */

export type TicketStatus =
	| "open"
	| "in_progress"
	| "awaiting_student"
	| "reopened"
	| "escalated"
	| "forwarded"
	| "resolved";

export interface TicketStatusConfig {
	label: string;
	color: string;
	progress: number;
	description: string;
	is_final?: boolean;
	display_order?: number;
}

export const TICKET_STATUS_CONFIG: Record<TicketStatus, TicketStatusConfig> = {
	open: {
		label: "Open",
		color: "blue",
		progress: 0,
		description: "Ticket has been created and is awaiting assignment",
		is_final: false,
		display_order: 1,
	},
	in_progress: {
		label: "In Progress",
		color: "yellow",
		progress: 50,
		description: "Admin is actively working on the ticket",
		is_final: false,
		display_order: 2,
	},
	awaiting_student: {
		label: "Awaiting Student Response",
		color: "orange",
		progress: 30,
		description: "Waiting for student response or clarification",
		is_final: false,
		display_order: 3,
	},
	reopened: {
		label: "Reopened",
		color: "purple",
		progress: 40,
		description: "Ticket was reopened after being resolved",
		is_final: false,
		display_order: 4,
	},
	escalated: {
		label: "Escalated",
		color: "red",
		progress: 60,
		description: "Ticket has been escalated to a higher level",
		is_final: false,
		display_order: 5,
	},
	forwarded: {
		label: "Forwarded",
		color: "indigo",
		progress: 45,
		description: "Ticket has been forwarded to another department",
		is_final: false,
		display_order: 6,
	},
	resolved: {
		label: "Resolved",
		color: "green",
		progress: 100,
		description: "Ticket has been resolved and closed",
		is_final: true,
		display_order: 7,
	},
} as const;

/**
 * Get status config by status value
 */
export function getStatusConfig(status: TicketStatus): TicketStatusConfig {
	return TICKET_STATUS_CONFIG[status];
}

/**
 * Get all active statuses (for dropdowns, filters, etc.)
 */
export function getAllStatuses(): Array<{
	value: TicketStatus;
	config: TicketStatusConfig;
}> {
	// Safety check: ensure TICKET_STATUS_CONFIG is a valid object
	if (!TICKET_STATUS_CONFIG || typeof TICKET_STATUS_CONFIG !== 'object' || Array.isArray(TICKET_STATUS_CONFIG)) {
		console.error('[getAllStatuses] TICKET_STATUS_CONFIG is not a valid object');
		return [];
	}
	try {
		return Object.entries(TICKET_STATUS_CONFIG).map(([value, config]) => ({
			value: value as TicketStatus,
			config: config && typeof config === 'object' ? config : {
				label: value,
				color: "default",
				progress: 0,
				description: "",
			},
		}));
	} catch (error) {
		console.error('[getAllStatuses] Error processing TICKET_STATUS_CONFIG:', error);
		return [];
	}
}

/**
 * Get statuses ordered by display_order
 */
export function getStatusesOrdered(): Array<{
	value: TicketStatus;
	config: TicketStatusConfig;
}> {
	return getAllStatuses().sort(
		(a, b) => (a.config.display_order || 0) - (b.config.display_order || 0)
	);
}

/**
 * Check if a status is final (resolved/closed)
 */
export function isFinalStatus(status: TicketStatus): boolean {
	return TICKET_STATUS_CONFIG[status]?.is_final === true;
}

/**
 * Get status label
 */
export function getStatusLabel(status: TicketStatus): string {
	return TICKET_STATUS_CONFIG[status]?.label || status;
}

/**
 * Get status color
 */
export function getStatusColor(status: TicketStatus): string {
	return TICKET_STATUS_CONFIG[status]?.color || "default";
}

