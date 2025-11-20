/**
 * Status Mapper - Maps between database enum values and application constants
 * Database uses uppercase enum: OPEN, ACKNOWLEDGED, IN_PROGRESS, etc.
 * Application uses lowercase constants: open, acknowledged, in_progress, etc.
 */

import { TICKET_STATUS } from "@/conf/constants";

/**
 * Map database enum status to application constant
 */
export function enumToStatus(enumStatus: string | null | undefined): string {
	if (!enumStatus) return TICKET_STATUS.OPEN;
	
	const mapping: Record<string, string> = {
		OPEN: TICKET_STATUS.OPEN,
		IN_PROGRESS: TICKET_STATUS.IN_PROGRESS,
		AWAITING_STUDENT: TICKET_STATUS.AWAITING_STUDENT_RESPONSE,
		REOPENED: TICKET_STATUS.REOPENED,
		ESCALATED: TICKET_STATUS.ESCALATED,
		RESOLVED: TICKET_STATUS.RESOLVED,
	};
	
	return mapping[enumStatus] || enumStatus.toLowerCase();
}

/**
 * Map application constant status to database enum
 */
export function statusToEnum(status: string | null | undefined): string {
	if (!status) return "OPEN";
	
	const mapping: Record<string, string> = {
		[TICKET_STATUS.OPEN]: "OPEN",
		[TICKET_STATUS.IN_PROGRESS]: "IN_PROGRESS",
		[TICKET_STATUS.AWAITING_STUDENT_RESPONSE]: "AWAITING_STUDENT",
		[TICKET_STATUS.REOPENED]: "REOPENED",
		[TICKET_STATUS.ESCALATED]: "ESCALATED",
		[TICKET_STATUS.RESOLVED]: "RESOLVED",
	};
	
	return mapping[status] || status.toUpperCase();
}

