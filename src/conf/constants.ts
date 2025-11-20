/**
 * Application Constants
 * Centralized constants used throughout the application
 */

/**
 * Ticket Status Values
 * PRD v3.0 Status Flow: New → In Progress → Awaiting Student Response → Reopened → Escalated/Forwarded → Resolved
 * NOTE: These values MUST match the database enum ticket_status in schema.ts
 */
export const TICKET_STATUS = {
    OPEN: "OPEN", // New (initial status)
    IN_PROGRESS: "IN_PROGRESS", // POC is working on it
    AWAITING_STUDENT_RESPONSE: "AWAITING_STUDENT", // Admin asked a question (enum is AWAITING_STUDENT)
    REOPENED: "REOPENED", // Student reopened a closed ticket
    ESCALATED: "ESCALATED", // Ticket has been escalated
    FORWARDED: "FORWARDED", // Ticket has been forwarded to next level
    RESOLVED: "RESOLVED", // Resolved successfully
} as const;

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
 * Status Display Names
 */
export const STATUS_DISPLAY: Record<string, string> = {
    [TICKET_STATUS.OPEN]: "New",
    [TICKET_STATUS.IN_PROGRESS]: "In Progress",
    [TICKET_STATUS.AWAITING_STUDENT_RESPONSE]: "Awaiting Student Response",
    [TICKET_STATUS.REOPENED]: "Reopened",
    [TICKET_STATUS.ESCALATED]: "Escalated",
    [TICKET_STATUS.FORWARDED]: "Forwarded",
    [TICKET_STATUS.RESOLVED]: "Resolved",
} as const;

/**
 * Status Badge Variants
 */
export const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
    [TICKET_STATUS.OPEN]: "default",
    [TICKET_STATUS.IN_PROGRESS]: "outline",
    [TICKET_STATUS.AWAITING_STUDENT_RESPONSE]: "outline",
    [TICKET_STATUS.REOPENED]: "default",
    [TICKET_STATUS.ESCALATED]: "destructive",
    [TICKET_STATUS.FORWARDED]: "secondary", // Blue/purple badge for forwarded tickets
    [TICKET_STATUS.RESOLVED]: "secondary",
} as const;

/**
 * Default domain/scope lists and assignment/escalation mappings
 */
export const HOSTELS = ["Velankani", "Neeladri"] as const;

export const DEFAULT_ASSIGNMENT: Record<string, string[]> = {
    "Hostel:Velankani": ["azad", "sunil", "minakshi"],
    "Hostel:Neeladri": ["vinay", "Surendra"],
    College: ["angel rasakumari", "bijay kumar Mishra", "shruti sagar"],
};

export const DEFAULT_ESCALATION: Record<string, string[]> = {
    // Bottom-up: local → college-level
    "Hostel:Velankani": [
        "azad", // same level
        "sunil", // same level
        "minakshi", // same level
        "Dharmendra Yadav",
        "angel rasakumari",
        "bijay kumar Mishra",
        "shruti sagar",
    ],
    "Hostel:Neeladri": [
        "vinay", // same level
        "Surendra", // same level
        "Dharmendra Yadav",
        "angel rasakumari",
        "bijay kumar Mishra",
        "shruti sagar",
    ],
    // Generic hostel fallback (if scope missing) escalates to college-level
    Hostel: ["Dharmendra Yadav", "angel rasakumari", "bijay kumar Mishra", "shruti sagar"],
    // College category escalation among college staff (order as provided)
    College: ["angel rasakumari", "bijay kumar Mishra", "shruti sagar"],
};
