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

export type TicketStatusMeta = {
    value: TicketStatusValue;
    label: string;
    description: string;
    progressPercent: number;
    badgeColor: "default" | "secondary" | "outline" | "destructive";
    isFinal: boolean;
    order: number;
};

export const STATUS_META: Record<TicketStatusValue, TicketStatusMeta> = {
    [TICKET_STATUS.OPEN]: {
        value: TICKET_STATUS.OPEN,
        label: "Open",
        description: "New ticket, awaiting assignment",
        progressPercent: 0,
        badgeColor: "default",
        isFinal: false,
        order: 1,
    },
    [TICKET_STATUS.IN_PROGRESS]: {
        value: TICKET_STATUS.IN_PROGRESS,
        label: "In Progress",
        description: "Admin is actively working",
        progressPercent: 40,
        badgeColor: "outline",
        isFinal: false,
        order: 2,
    },
    [TICKET_STATUS.AWAITING_STUDENT]: {
        value: TICKET_STATUS.AWAITING_STUDENT,
        label: "Awaiting Student Response",
        description: "Waiting for student response",
        progressPercent: 50,
        badgeColor: "outline",
        isFinal: false,
        order: 3,
    },
    [TICKET_STATUS.REOPENED]: {
        value: TICKET_STATUS.REOPENED,
        label: "Reopened",
        description: "Student reopened the ticket",
        progressPercent: 10,
        badgeColor: "default",
        isFinal: false,
        order: 4,
    },
    [TICKET_STATUS.ESCALATED]: {
        value: TICKET_STATUS.ESCALATED,
        label: "Escalated",
        description: "Escalated to higher authority",
        progressPercent: 60,
        badgeColor: "destructive",
        isFinal: false,
        order: 5,
    },
    [TICKET_STATUS.FORWARDED]: {
        value: TICKET_STATUS.FORWARDED,
        label: "Forwarded",
        description: "Forwarded to another admin",
        progressPercent: 30,
        badgeColor: "secondary",
        isFinal: false,
        order: 6,
    },
    [TICKET_STATUS.RESOLVED]: {
        value: TICKET_STATUS.RESOLVED,
        label: "Resolved",
        description: "Successfully resolved",
        progressPercent: 100,
        badgeColor: "secondary",
        isFinal: true,
        order: 7,
    },
};

export const STATUS_ALIASES: Record<string, TicketStatusValue> = {
    awaiting_student_response: TICKET_STATUS.AWAITING_STUDENT,
    closed: TICKET_STATUS.RESOLVED,
};

export function getCanonicalStatus(status: string | null | undefined): TicketStatusValue | null {
    if (!status) return null;
    const normalized = status.toLowerCase().trim();
    return (STATUS_META as Record<string, TicketStatusMeta>)[normalized]?.value ?? STATUS_ALIASES[normalized] ?? null;
}

export function getStatusMeta(status: string | null | undefined): TicketStatusMeta | null {
    const canonical = getCanonicalStatus(status);
    return canonical ? STATUS_META[canonical] : null;
}

export function buildStatusDisplay(status: string | null | undefined) {
    const canonical = getCanonicalStatus(status);
    if (!canonical) return null;
    const meta = STATUS_META[canonical];
    return {
        value: canonical,
        label: meta.label,
        badge_color: meta.badgeColor,
    };
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
 * Status Display Names
 */
// Safety check: ensure STATUS_META is a valid object before calling Object.entries
let STATUS_DISPLAY: Record<string, string> = {};
try {
    // Double-check STATUS_META is valid
    if (!STATUS_META || typeof STATUS_META !== 'object' || Array.isArray(STATUS_META)) {
        STATUS_DISPLAY = {};
    } else {
        const safeStatusMeta = STATUS_META;
        // Additional safety: ensure it's not null/undefined before Object.entries
        if (safeStatusMeta != null && typeof safeStatusMeta === 'object' && !Array.isArray(safeStatusMeta)) {
            try {
                STATUS_DISPLAY = Object.entries(safeStatusMeta).reduce(
                    (acc, [key, meta]) => {
                        if (key && meta && typeof meta === 'object' && meta != null && 'label' in meta) {
                            acc[key] = (meta as { label?: string }).label || '';
                        }
                        return acc;
                    },
                    {} as Record<string, string>
                );
            } catch (reduceError) {
                console.error('[Constants] Error in STATUS_DISPLAY reduce:', reduceError);
                STATUS_DISPLAY = {};
            }

            // Safety check: ensure STATUS_ALIASES is a valid object before calling Object.entries
            const safeStatusAliases = STATUS_ALIASES && typeof STATUS_ALIASES === 'object' && !Array.isArray(STATUS_ALIASES) ? STATUS_ALIASES : {};
            if (safeStatusAliases != null && typeof safeStatusAliases === 'object' && !Array.isArray(safeStatusAliases) && Object.keys(safeStatusAliases).length > 0) {
                try {
                    for (const [alias, canonical] of Object.entries(safeStatusAliases)) {
                        if (alias && canonical && safeStatusMeta[canonical]) {
                            STATUS_DISPLAY[alias] = safeStatusMeta[canonical]?.label || '';
                        }
                    }
                } catch (aliasError) {
                    console.error('[Constants] Error processing STATUS_ALIASES:', aliasError);
                }
            }
        }
    }
} catch (error) {
    console.error('[Constants] Error initializing STATUS_DISPLAY:', error);
    STATUS_DISPLAY = {};
}
export { STATUS_DISPLAY };

/**
 * Status Badge Variants
 */
let STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {};
try {
    // Double-check STATUS_META is valid
    if (!STATUS_META || typeof STATUS_META !== 'object' || Array.isArray(STATUS_META)) {
        STATUS_VARIANT = {};
    } else {
        const safeStatusMeta = STATUS_META;
        // Additional safety: ensure it's not null/undefined before Object.entries
        if (safeStatusMeta != null && typeof safeStatusMeta === 'object' && !Array.isArray(safeStatusMeta)) {
            try {
                STATUS_VARIANT = Object.entries(safeStatusMeta).reduce(
                    (acc, [key, meta]) => {
                        if (key && meta && typeof meta === 'object' && meta != null && 'badgeColor' in meta) {
                            const badgeColor = (meta as { badgeColor?: string }).badgeColor || 'default';
                            acc[key] = (badgeColor === 'default' || badgeColor === 'secondary' || badgeColor === 'outline' || badgeColor === 'destructive') 
                              ? badgeColor 
                              : 'default';
                        }
                        return acc;
                    },
                    {} as Record<string, "default" | "secondary" | "outline" | "destructive">
                );
            } catch (reduceError) {
                console.error('[Constants] Error in STATUS_VARIANT reduce:', reduceError);
                STATUS_VARIANT = {};
            }

            const safeStatusAliases = STATUS_ALIASES && typeof STATUS_ALIASES === 'object' && !Array.isArray(STATUS_ALIASES) ? STATUS_ALIASES : {};
            if (safeStatusAliases != null && typeof safeStatusAliases === 'object' && !Array.isArray(safeStatusAliases) && Object.keys(safeStatusAliases).length > 0) {
                try {
                    for (const [alias, canonical] of Object.entries(safeStatusAliases)) {
                        if (alias && canonical && safeStatusMeta[canonical]) {
                            STATUS_VARIANT[alias] = safeStatusMeta[canonical]?.badgeColor || 'default';
                        }
                    }
                } catch (aliasError) {
                    console.error('[Constants] Error processing STATUS_ALIASES in STATUS_VARIANT:', aliasError);
                }
            }
        }
    }
} catch (error) {
    console.error('[Constants] Error initializing STATUS_VARIANT:', error);
    STATUS_VARIANT = {};
}
export { STATUS_VARIANT };

/**
 * NOTE: Assignment and escalation rules are now managed dynamically through the database:
 * - Domains and Scopes: stored in `domains` and `scopes` tables
 * - Escalation Rules: stored in `escalation_rules` table (domain/scope-based)
 * - SPOC Assignment: handled by `@/lib/assignment/spoc-assignment.ts` using database lookups
 * 
 * These should be configured through the Super Admin UI or database directly,
 * not hardcoded in constants.
 */
