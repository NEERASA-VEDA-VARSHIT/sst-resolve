/**
 * Status Utilities
 * Helper functions for working with ticket statuses
 */

import { TICKET_STATUS } from "@/conf/constants";

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
  
  // Valid statuses from database enum
  const validStatuses = [
    "open",
    "in_progress", 
    "awaiting_student_response", // Maps to AWAITING_STUDENT in DB
    "awaiting_student",          // Also accept DB enum format
    "reopened",
    "escalated",                 // Valid DB status (though may be deprecated in favor of escalation_level)
    "resolved",
  ];
  
  return validStatuses.includes(normalized);
}

/**
 * Get status display options for filters
 * Returns array of { value, label } objects for UI filters
 * Note: "Escalated" is included as a special filter (checks escalation_level > 0)
 */
export function getStatusFilterOptions(): Array<{ value: string; label: string }> {
  return [
    { value: "open", label: "Open" },
    { value: "in_progress", label: "In Progress" },
    { value: "awaiting_student_response", label: "Awaiting Student Response" },
    { value: "reopened", label: "Reopened" },
    { value: "resolved", label: "Resolved" },
    // Special filters (not direct DB statuses)
    { value: "escalated", label: "Escalated" }, // Special: filters by escalation_level > 0
  ];
}

