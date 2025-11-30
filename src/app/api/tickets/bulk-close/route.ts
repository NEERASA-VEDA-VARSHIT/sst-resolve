import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, inArray } from "drizzle-orm";
import { db, tickets } from "@/db";
import type { TicketInsert } from "@/db/inferred-types";
import { BulkCloseTicketsSchema } from "@/schemas/business/ticket";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import { getCanonicalStatus, TICKET_STATUS } from "@/conf/constants";
import type { TicketMetadata } from "@/db/inferred-types";
import { getStatusIdByValue } from "@/lib/status/getTicketStatuses";

/**
 * ============================================
 * /api/tickets/bulk-close
 * ============================================
 * 
 * POST → Bulk Close Tickets
 *   - Auth: Required (Admin only)
 *   - Close multiple tickets at once
 *   - Body: { ticketIds: number[], reason: string (optional) }
 *   - Updates status to CLOSED for all specified tickets
 *   - Notifies affected students
 *   - Returns: 200 OK with count of closed tickets
 * ============================================
 */

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user exists in database
    await getOrCreateUser(userId);

    // Get role from database (single source of truth)
    const role = await getUserRoleFromDB(userId);
    const isAdmin = role === "admin" || role === "super_admin";

    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = BulkCloseTicketsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }

    const { ticket_ids } = parsed.data;
    const comment = ""; // Bulk close doesn't use comments
    const status = TICKET_STATUS.RESOLVED; // Bulk close always resolves
    const targetStatusValue = getCanonicalStatus(status || TICKET_STATUS.RESOLVED) || TICKET_STATUS.RESOLVED;

    // Get status ID for resolved status
    const resolvedStatusId = await getStatusIdByValue(targetStatusValue);
    if (!resolvedStatusId) {
      return NextResponse.json({ error: "Resolved status not found in database" }, { status: 500 });
    }

    // Fetch the tickets to modify
    const rows = await db.select().from(tickets).where(inArray(tickets.id, ticket_ids));
    if (rows.length === 0) {
      return NextResponse.json({ error: "No tickets found for the provided ids" }, { status: 404 });
    }

    // Update metadata with optional bulk-close comment and set status
    const now = new Date();
    for (const row of rows) {
      let metadata: TicketMetadata = {};
      try {
        metadata = row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) as TicketMetadata : row.metadata as TicketMetadata) : {};
      } catch { }

      if (comment) {
        const comments = Array.isArray(metadata.comments) ? metadata.comments : [];
        comments.push({
          text: comment,
          author: "Admin",
          createdAt: now.toISOString(),
          type: "internal_note",
          isInternal: true,
          source: "bulk_action",
        });
        metadata.comments = comments;
      }

      // Set resolved_at in metadata
      metadata.resolved_at = now.toISOString();

      const updateData: Partial<TicketInsert> = {
        status_id: resolvedStatusId,
        updated_at: now,
        metadata: metadata as unknown,
      };

      await db
        .update(tickets)
        .set(updateData)
        .where(eq(tickets.id, row.id));
    }

    return NextResponse.json({ success: true, updated: rows.map((r) => r.id) });
  } catch (error) {
    console.error("Error bulk closing tickets:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}


