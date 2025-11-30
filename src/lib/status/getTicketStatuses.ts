import "server-only";
import { getCanonicalStatus } from "@/conf/constants";
import { db } from "@/db";
import { tickets, ticket_statuses } from "@/db/schema";
import { sql, eq } from "drizzle-orm";

// Type for ticket status values (matches database values)
export type TicketStatus =
	| "open"
	| "in_progress"
	| "awaiting_student"
	| "reopened"
	| "escalated"
	| "forwarded"
	| "resolved";

/**
 * Get all ticket statuses from database
 */
export async function getTicketStatuses(): Promise<Array<{
    id: number;
    value: string;
    label: string;
    description: string | null;
    progress_percent: number | null;
    badge_color: string | null;
    is_active: boolean | null;
    is_final: boolean | null;
    display_order: number | null;
}>> {
    return await db
        .select()
        .from(ticket_statuses)
        .where(eq(ticket_statuses.is_active, true))
        .orderBy(ticket_statuses.display_order);
}

export async function getTicketStatusByValue(value: string): Promise<{
    id: number;
    value: string;
    label: string;
    description: string | null;
    progress_percent: number | null;
    badge_color: string | null;
    is_active: boolean | null;
    is_final: boolean | null;
    display_order: number | null;
} | null> {
    const canonical = getCanonicalStatus(value);
    if (!canonical) return null;
    
    const [status] = await db
        .select()
        .from(ticket_statuses)
        .where(eq(ticket_statuses.value, canonical))
        .limit(1);
    
    return status ?? null;
}

/**
 * Get status_id from status value (helper for updates)
 */
export async function getStatusIdByValue(value: string): Promise<number | null> {
    const status = await getTicketStatusByValue(value);
    return status?.id ?? null;
}

export function buildProgressMap(
    statuses: Awaited<ReturnType<typeof getTicketStatuses>> = []
): Record<string, number> {
    // Safety check: ensure statuses is a valid array
    if (!Array.isArray(statuses) || statuses.length === 0) {
        return {};
    }
    try {
        return Object.fromEntries(
            statuses
                .filter((status) => status && typeof status === 'object' && status.value && (typeof status.progress_percent === 'number' || status.progress_percent !== null))
                .map((status) => [status.value, status.progress_percent ?? 0])
        ) as Record<string, number>;
    } catch (error) {
        console.error('[buildProgressMap] Error building progress map:', error);
        return {};
    }
}

export function buildBadgeColorMap(
    statuses: Awaited<ReturnType<typeof getTicketStatuses>> = []
): Record<string, string> {
    // Safety check: ensure statuses is a valid array
    if (!Array.isArray(statuses) || statuses.length === 0) {
        return {};
    }
    try {
        return Object.fromEntries(
            statuses
                .filter((status) => status && typeof status === 'object' && status.value)
                .map((status) => [status.value, status.badge_color || "default"])
        );
    } catch (error) {
        console.error('[buildBadgeColorMap] Error building badge color map:', error);
        return {};
    }
}

export async function getAllTicketStatuses(): Promise<Awaited<ReturnType<typeof getTicketStatuses>>> {
    return getTicketStatuses();
}

export async function getTicketCountByStatus(statusValue: string): Promise<number> {
    const canonical = getCanonicalStatus(statusValue);
    if (!canonical) return 0;

    // Get status_id from ticket_statuses
    const status = await getTicketStatusByValue(canonical);
    if (!status) return 0;

    const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(tickets)
        .where(eq(tickets.status_id, status.id));

    return result?.count || 0;
}
