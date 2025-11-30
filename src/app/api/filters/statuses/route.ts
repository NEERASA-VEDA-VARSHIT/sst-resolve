import { NextResponse } from "next/server";
import { getTicketStatuses } from "@/lib/status/getTicketStatuses";

/**
 * GET /api/filters/statuses
 * Fetch all valid ticket statuses using getTicketStatuses
 */
export async function GET() {
  try {
    // Use getTicketStatuses which returns active statuses from the database
    const statuses = await getTicketStatuses();

    // Ensure statuses is an array
    if (!Array.isArray(statuses)) {
      console.error("Statuses query did not return an array:", statuses);
      return NextResponse.json({ statuses: [] });
    }

    // Sort by display_order
    const sortedStatuses = statuses
      .filter((status) => status.is_active)
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

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

