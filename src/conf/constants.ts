/**
 * Application Constants
 * Centralized constants used throughout the application
 */

/**
 * Ticket Status Values (canonical, lowercase to match DB enums)
 */
export const TICKET_STATUS = {
    OPEN: "open",
    IN_PROGRESS: "in_progress",
    AWAITING_STUDENT: "awaiting_student",
    REOPENED: "reopened",
    ESCALATED: "escalated",
    FORWARDED: "forwarded",
    RESOLVED: "resolved",
} as const;

export type TicketStatusValue = (typeof TICKET_STATUS)[keyof typeof TICKET_STATUS];

/**
 * @deprecated Status metadata (labels, colors, progress) now comes from database (ticket_statuses table)
 * Only canonical values and aliases remain here for normalization
 */

export const STATUS_ALIASES: Record<string, TicketStatusValue> = {
    awaiting_student_response: TICKET_STATUS.AWAITING_STUDENT,
    closed: TICKET_STATUS.RESOLVED,
};

/**
 * Normalize status string to canonical value
 * Only handles value normalization and aliases - metadata comes from DB
 */
export function getCanonicalStatus(status: string | null | undefined): TicketStatusValue | null {
    if (!status) return null;
    const normalized = status.toLowerCase().trim();
    
    // Check if it's already a canonical value
    const values = Object.values(TICKET_STATUS);
    if (values.includes(normalized as TicketStatusValue)) {
        return normalized as TicketStatusValue;
    }
    
    // Check aliases
    if (normalized in STATUS_ALIASES) {
        return STATUS_ALIASES[normalized];
    }
    
    return null;
}

/**
 * Ticket Categories
 */
export const TICKET_CATEGORY = {
    HOSTEL: "Hostel",
    COLLEGE: "College",
} as const;

/**
 * User Roles
 */
export const USER_ROLE = {
    STUDENT: "student",
    ADMIN: "admin",
    SUPER_ADMIN: "super_admin",
    COMMITTEE: "committee",
} as const;

/**
 * Helper function to check if a role has admin-level permissions
 * Committee members have same permissions as admins
 */
export function isAdminLevel(role: string | null | undefined): boolean {
    return role === "admin" || role === "super_admin" || role === "committee";
}

/**
 * Comment Types
 */
export const COMMENT_TYPE = {
    STUDENT_VISIBLE: "student_visible",
    INTERNAL_NOTE: "internal_note",
    SUPER_ADMIN_NOTE: "super_admin_note",
} as const;

/**
 * Escalation Targets
 */
export const ESCALATION_TARGET = {
    SUPER_ADMIN: "super_admin",
    SUPER_ADMIN_URGENT: "super_admin_urgent",
} as const;

/**
 * Rating Constants
 * PRD v3.0: Happy/Unhappy feedback system
 */
export const RATING = {
    MIN: 1,
    MAX: 5,
    HAPPY_THRESHOLD: 3, // Ratings >= 3 are considered "Happy", < 3 are "Unhappy"
} as const;

/**
 * Feedback Types (mapped from ratings)
 */
export const FEEDBACK_TYPE = {
    HAPPY: "happy",
    UNHAPPY: "unhappy",
} as const;

/**
 * TAT Filter Options
 */
export const TAT_FILTER = {
    HAS: "has",
    NONE: "none",
    DUE: "due",
    UPCOMING: "upcoming",
    TODAY: "today",
} as const;

/**
 * Sort Options
 */
export const SORT_OPTION = {
    NEWEST: "newest",
    OLDEST: "oldest",
} as const;

/**
 * Default Values
 */
export const DEFAULTS = {
    TICKET_STATUS: TICKET_STATUS.OPEN,
    MAX_TICKETS_PER_WEEK: 3,
    AUTO_ESCALATION_DAYS: 7,
    ESCALATION_COOLDOWN_DAYS: 2,
    ESCALATION_COUNT: "0",
    MAX_TAT_EXTENSIONS: 3, // Auto-escalate after 3 TAT extensions
} as const;

/**
 * Time Constants (in milliseconds)
 */
export const TIME = {
    SECOND: 1000,
    MINUTE: 60 * 1000,
    HOUR: 60 * 60 * 1000,
    DAY: 24 * 60 * 60 * 1000,
    WEEK: 7 * 24 * 60 * 60 * 1000,
    MONTH: 30 * 24 * 60 * 60 * 1000, // Approximate
} as const;

/**
 * @deprecated STATUS_DISPLAY removed - use getTicketStatuses() from DB instead
 * @deprecated STATUS_VARIANT removed - use getTicketStatuses() from DB instead
 */

/**
 * NOTE: Assignment and escalation rules are now managed dynamically through the database:
 * - Domains and Scopes: stored in `domains` and `scopes` tables
 * - Escalation Rules: stored in `escalation_rules` table (domain/scope-based)
 * - SPOC Assignment: handled by `@/lib/assignment/spoc-assignment.ts` using database lookups
 * 
 * These should be configured through the Super Admin UI or database directly,
 * not hardcoded in constants.
 */
