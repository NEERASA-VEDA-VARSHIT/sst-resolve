/**
 * Status helpers for dynamic ticket_statuses table
 * Replaces the old status-mapper.ts which was for hardcoded enums
 */

import { db } from "@/db";
import { ticket_statuses } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Get status ID by value (e.g., "OPEN" → 1)
 * Used when you need to query by status
 */
export async function getStatusIdByValue(value: string): Promise<number | null> {
    const result = await db
        .select({ id: ticket_statuses.id })
        .from(ticket_statuses)
        .where(eq(ticket_statuses.value, value))
        .limit(1);

    return result[0]?.id ?? null;
}

/**
 * Get full status object by value
 */
export async function getStatusByValue(value: string) {
    const result = await db
        .select()
        .from(ticket_statuses)
        .where(eq(ticket_statuses.value, value))
        .limit(1);

    return result[0] ?? null;
}

/**
 * Get all active statuses (for dropdowns)
 */
export async function getAllStatuses() {
    return await db
        .select()
        .from(ticket_statuses)
        .where(eq(ticket_statuses.is_active, true))
        .orderBy(ticket_statuses.display_order);
}

/**
 * Legacy compatibility: Map old enum-style status to status object
 * @deprecated - Use getStatusByValue instead
 */
export async function enumToStatus(enumValue: string) {
    return await getStatusByValue(enumValue);
}

/**
 * Legacy compatibility: Map status to enum value (returns the value itself since we use values now)
 * @deprecated - Just use the status value directly
 */
export function statusToEnum(status: string): string {
    return status;
}
