import { NextResponse } from "next/server";
import { db, ticket_statuses } from "@/db";
import { eq } from "drizzle-orm";

/**
 * GET /api/filters/statuses
 * Fetch all valid ticket statuses from the ticket_statuses table
 */
export async function GET() {
  try {
    // Query ticket_statuses table for active statuses
    const statuses = await db
      .select({
        id: ticket_statuses.id,
        value: ticket_statuses.value,
        label: ticket_statuses.label,
        is_active: ticket_statuses.is_active,
        sort_order: ticket_statuses.sort_order,
      })
      .from(ticket_statuses)
      .where(eq(ticket_statuses.is_active, true));

    // Ensure statuses is an array
    if (!Array.isArray(statuses)) {
      console.error("Statuses query did not return an array:", statuses);
      return NextResponse.json({ statuses: [] });
    }

    // Sort manually to avoid issues with orderBy
    const sortedStatuses = statuses.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    // Map to the expected format with null checks
    const statusOptions = sortedStatuses
      .filter((status) => status != null && typeof status === 'object')
      .map((status) => ({
        value: status.value?.toLowerCase() || '',
        label: status.label || '',
        enum: status.value || '', // Keep original value
      }));

    return NextResponse.json({ statuses: statusOptions });
  } catch (error) {
    console.error("Error fetching statuses:", error);
    // Return empty array instead of error to prevent client-side crashes
    return NextResponse.json({ statuses: [] }, { status: 200 });
  }
}

