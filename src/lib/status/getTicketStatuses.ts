import { db } from "@/db";
import { ticket_statuses, tickets } from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";

export interface TicketStatus {
    id: number;
    value: string;
    label: string;
    description: string | null;
    progress_percent: number;
    badge_color: string | null;
    is_active: boolean;
    is_final: boolean;
    display_order: number;
}

/**
 * Fetch all active ticket statuses from the database, ordered by display_order
 * Results are cached for 5 minutes to reduce database load
 */
export const getTicketStatuses = unstable_cache(
    async (): Promise<TicketStatus[]> => {
        try {
            const statuses = await db
                .select()
                .from(ticket_statuses)
                .where(eq(ticket_statuses.is_active, true))
                .orderBy(asc(ticket_statuses.display_order));

            return statuses;
        } catch (error) {
            console.error("[getTicketStatuses] Failed to fetch ticket statuses:", error);
            // Return fallback statuses to prevent catastrophic failure
            return [
                {
                    id: 1,
                    value: "OPEN",
                    label: "Open",
                    description: "New ticket",
                    progress_percent: 10,
                    badge_color: "default",
                    is_active: true,
                    is_final: false,
                    display_order: 1,
                },
                {
                    id: 2,
                    value: "IN_PROGRESS",
                    label: "In Progress",
                    description: "Being worked on",
                    progress_percent: 50,
                    badge_color: "secondary",
                    is_active: true,
                    is_final: false,
                    display_order: 2,
                },
                {
                    id: 3,
                    value: "RESOLVED",
                    label: "Resolved",
                    description: "Issue resolved",
                    progress_percent: 100,
                    badge_color: "default",
                    is_active: true,
                    is_final: true,
                    display_order: 3,
                },
            ];
        }
    },
    ["ticket-statuses"],
    {
        revalidate: 300, // Cache for 5 minutes
        tags: ["ticket-statuses"],
    }
);

/**
 * Get a specific status by its value
 */
export async function getTicketStatusByValue(value: string): Promise<TicketStatus | null> {
    try {
        const [status] = await db
            .select()
            .from(ticket_statuses)
            .where(eq(ticket_statuses.value, value))
            .limit(1);

        return status || null;
    } catch (error) {
        console.error(`[getTicketStatusByValue] Failed to fetch status ${value}:`, error);
        return null;
    }
}

/**
 * Build a progress map from statuses array
 * Returns object like { "OPEN": 10, "IN_PROGRESS": 50, ... }
 */
export function buildProgressMap(statuses: TicketStatus[]): Record<string, number> {
    return Object.fromEntries(
        statuses.map(s => [s.value.toLowerCase(), s.progress_percent])
    );
}

/**
 * Build a badge color map from statuses array
 * Returns object like { "OPEN": "default", "IN_PROGRESS": "secondary", ... }
 */
export function buildBadgeColorMap(statuses: TicketStatus[]): Record<string, string> {
    return Object.fromEntries(
        statuses.map(s => [s.value, s.badge_color || "default"])
    );
}

/**
 * Get all ticket statuses including inactive ones (for admin/super-admin)
 * No caching - always fetches latest data
 */
export async function getAllTicketStatuses(): Promise<TicketStatus[]> {
    try {
        const statuses = await db
            .select()
            .from(ticket_statuses)
            .orderBy(asc(ticket_statuses.display_order));

        return statuses;
    } catch (error) {
        console.error("[getAllTicketStatuses] Failed to fetch all ticket statuses:", error);
        return [];
    }
}

/**
 * Get count of tickets using a specific status value
 */
export async function getTicketCountByStatus(statusValue: string): Promise<number> {
    try {
        const [result] = await db
            .select({ count: sql<number>`count(*)` })
            .from(tickets)
            .where(eq(tickets.status, statusValue as any));

        return result?.count || 0;
    } catch (error) {
        console.error(`[getTicketCountByStatus] Failed to count tickets for status ${statusValue}:`, error);
        return 0;
    }
}

/**
 * Check if a status can be safely deleted
 * Returns count of tickets using this status
 */
export async function canDeleteStatus(statusId: number): Promise<{ canDelete: boolean; ticketCount: number }> {
    try {
        const [status] = await db
            .select({ value: ticket_statuses.value })
            .from(ticket_statuses)
            .where(eq(ticket_statuses.id, statusId))
            .limit(1);

        if (!status) {
            return { canDelete: false, ticketCount: 0 };
        }

        const ticketCount = await getTicketCountByStatus(status.value);
        return {
            canDelete: ticketCount === 0,
            ticketCount,
        };
    } catch (error) {
        console.error(`[canDeleteStatus] Failed to check if status ${statusId} can be deleted:`, error);
        return { canDelete: false, ticketCount: 0 };
    }
}
