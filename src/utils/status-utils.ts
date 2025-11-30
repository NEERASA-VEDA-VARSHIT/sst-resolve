/**
 * Status Utilities
 * Helper functions for working with ticket statuses
 */

import { STATUS_ALIASES, TICKET_STATUS } from "@/conf/constants";

/**
 * Get all valid ticket status values from the database enum
 * Returns lowercase constant values that match actual DB enum
 * 
 * Database enum: OPEN, IN_PROGRESS, AWAITING_STUDENT, REOPENED, ESCALATED, RESOLVED
 * Application constants: open, in_progress, awaiting_student_response, reopened, escalated, resolved
 */
export function getValidStatuses(): string[] {
  return Object.values(TICKET_STATUS);
}

/**
 * Check if a status value is valid
 * Validates against actual database enum statuses
 */
export function isValidStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const normalized = status.toLowerCase().trim();
  if (STATUS_ALIASES[normalized]) return true;
  return Object.values(TICKET_STATUS).includes(normalized as typeof TICKET_STATUS[keyof typeof TICKET_STATUS]);
}

/**
 * Get status display options for filters
 * Returns array of { value, label } objects for UI filters
 * Note: "Escalated" is included as a special filter (checks escalation_level > 0)
 */
export function getStatusFilterOptions(): Array<{ value: string; label: string }> {
  return [
    { value: TICKET_STATUS.OPEN, label: "Open" },
    { value: TICKET_STATUS.IN_PROGRESS, label: "In Progress" },
    { value: TICKET_STATUS.AWAITING_STUDENT, label: "Awaiting Student Response" },
    { value: TICKET_STATUS.REOPENED, label: "Reopened" },
    { value: TICKET_STATUS.RESOLVED, label: "Resolved" },
    // Special filters (not direct DB statuses)
    { value: "escalated", label: "Escalated" }, // Special: filters by escalation_level > 0
  ];
}

