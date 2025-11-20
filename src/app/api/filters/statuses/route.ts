import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * GET /api/filters/statuses
 * Fetch all valid ticket statuses from the database enum
 */
export async function GET() {
  try {
    // Query PostgreSQL enum values directly
    const result = await db.execute(sql`
      SELECT unnest(enum_range(NULL::ticket_status))::text AS status
      ORDER BY status;
    `);

    // Extract statuses from result (format may vary by Drizzle version)
    const statuses = Array.isArray(result) 
      ? result.map((row: any) => row.status)
      : (result as any).rows?.map((row: any) => row.status) || [];
    
    // Map database enum values to display format
    const statusOptions = statuses
      .filter((status: string) => {
        // Filter out removed statuses (ACKNOWLEDGED, CLOSED) if they still exist in enum
        const upper = status.toUpperCase();
        return upper !== "ACKNOWLEDGED" && upper !== "CLOSED";
      })
      .map((status: string) => {
        const normalized = status.toLowerCase();
        let label = status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
        
        // Special handling for specific statuses
        if (normalized === "awaiting_student") {
          label = "Awaiting Student Response";
        }
        
        return {
          value: normalized,
          label: label,
          enum: status, // Keep original enum value
        };
      });

    return NextResponse.json({ statuses: statusOptions });
  } catch (error) {
    console.error("Error fetching statuses:", error);
    return NextResponse.json(
      { error: "Failed to fetch statuses" },
      { status: 500 }
    );
  }
}


