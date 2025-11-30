import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tickets, outbox, ticket_committee_tags, committees, ticket_statuses } from "@/db/schema";
import { getStatusIdByValue } from "@/lib/status/getTicketStatuses";
import type { TicketInsert } from "@/db/inferred-types";
import { eq, sql, and, inArray } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import { UpdateTicketStatusSchema } from "@/schemas/business/ticket";
import { TICKET_STATUS, getCanonicalStatus } from "@/conf/constants";

/**
 * ============================================
 * /api/tickets/[id]/status
 * ============================================
 * 
 * PATCH → Update Ticket Status
 *   - Auth: Required
 *   - Permissions:
 *     • Admin: Update to ANY status
 *     • Committee: Can resolve/close only their tagged tickets
 *     • Student: Can only reopen their own closed/resolved tickets
 *   - Returns: 200 OK with updated ticket
 * ============================================
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // -------------------------
    // AUTH
    // -------------------------
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const ticketId = Number(id);
    if (isNaN(ticketId))
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });

    const body = await request.json();
    
    const canonicalStatus = typeof body.status === "string" ? getCanonicalStatus(body.status) : null;
    
    const parsed = UpdateTicketStatusSchema.safeParse({ status: canonicalStatus });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid status", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const newStatus = parsed.data.status;

    // -------------------------
    // USER + ROLE
    // -------------------------
    const localUser = await getOrCreateUser(userId);
    if (!localUser)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    const role = await getUserRoleFromDB(userId);
    const isAdmin = role === "admin" || role === "super_admin";
    const isStudent = role === "student";
    const isCommittee = role === "committee";

    // -------------------------
    // LOAD TICKET WITH STATUS
    // -------------------------
    const [ticket] = await db
      .select({
        id: tickets.id,
        created_by: tickets.created_by,
        status: ticket_statuses.value,
        status_id: tickets.status_id,
        group_id: tickets.group_id,
        metadata: tickets.metadata,
      })
      .from(tickets)
      .leftJoin(ticket_statuses, eq(ticket_statuses.id, tickets.status_id))
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket)
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

    // -------------------------
    // PERMISSIONS
    // -------------------------

    // Students → can ONLY reopen their own resolved ticket
    if (isStudent) {
      const currentStatus = getCanonicalStatus(ticket.status) || ticket.status?.toLowerCase();
      if (ticket.created_by !== localUser.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (currentStatus !== TICKET_STATUS.RESOLVED || newStatus !== TICKET_STATUS.REOPENED) {
        return NextResponse.json(
          { error: "Students can only reopen resolved tickets" },
          { status: 403 }
        );
      }
    }

    // Committee → can only resolve tickets tagged to their committee
    if (isCommittee) {
      const committeeRecords = await db
        .select({ id: committees.id })
        .from(committees)
        .where(eq(committees.head_id, localUser.id));

      const committeeIds = committeeRecords.map((c) => c.id);

      if (committeeIds.length === 0) {
        return NextResponse.json(
          { error: "Committee membership not found" },
          { status: 403 }
        );
      }

      const [tagRecord] = await db
        .select({ ticket_id: ticket_committee_tags.ticket_id })
        .from(ticket_committee_tags)
        .where(
          and(
            eq(ticket_committee_tags.ticket_id, ticketId),
            inArray(ticket_committee_tags.committee_id, committeeIds)
          )
        )
        .limit(1);

      if (!tagRecord) {
        return NextResponse.json(
          { error: "You can only update tickets tagged to your committee" },
          { status: 403 }
        );
      }

      if (newStatus !== TICKET_STATUS.RESOLVED) {
        return NextResponse.json(
          { error: "Committee members can only mark tickets as resolved" },
          { status: 403 }
        );
      }
    }

    // Admin → can change status freely
    if (!isAdmin && !isStudent && !isCommittee) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // -------------------------
    // STATUS TRANSITION RULES
    // -------------------------

    // Handle TAT pause when status changes to AWAITING_STUDENT
    let metadata: Record<string, unknown> = {};
    if (ticket.metadata && typeof ticket.metadata === 'object' && !Array.isArray(ticket.metadata)) {
      metadata = { ...ticket.metadata as Record<string, unknown> };
    }
    const currentStatusValue = ticket.status || "";
    if (newStatus === TICKET_STATUS.AWAITING_STUDENT && currentStatusValue !== TICKET_STATUS.AWAITING_STUDENT) {
      // Pause TAT - record pause start time
      metadata.tatPauseStart = new Date().toISOString();
      // Initialize paused duration if not exists
      if (!metadata.tatPausedDuration) {
        metadata.tatPausedDuration = 0;
      }
    }

    // Get status_id from status value
    const newStatusId = await getStatusIdByValue(newStatus);
    if (!newStatusId) {
      return NextResponse.json(
        { error: `Invalid status: ${newStatus}` },
        { status: 400 }
      );
    }

    // SET TIMESTAMPS - Update metadata for resolved_at and reopened_at
    if (newStatus === TICKET_STATUS.RESOLVED) {
      metadata.resolved_at = new Date().toISOString();
    }
    if (newStatus === TICKET_STATUS.REOPENED) {
      metadata.reopened_at = new Date().toISOString();
      // Increment reopen_count in metadata
      const currentReopenCount = (metadata.reopen_count as number) || 0;
      metadata.reopen_count = currentReopenCount + 1;
      // Reset TAT pause tracking for new TAT cycle
      metadata.tatPauseStart = undefined;
      metadata.tatPausedDuration = 0;
      // Clear TAT for new cycle (admin will set new TAT)
      metadata.tat = undefined;
      metadata.tatDate = undefined;
      metadata.tatSetAt = undefined;
      metadata.tatSetBy = undefined;
    }

    // Build update data
    const updateData: Partial<TicketInsert> = {
      status_id: newStatusId,
      updated_at: new Date(),
      metadata: metadata as unknown,
    };

    // Admin taking action → assign the ticket to themselves automatically
    if (isAdmin) {
      updateData.assigned_to = localUser.id;
    }

    // -------------------------
    // DB TRANSACTION — Update Ticket + Insert Outbox Event
    // -------------------------
    const updatedTicket = await db.transaction(async (tx) => {
      // Update ticket
      const [ticketUpdated] = await tx
        .update(tickets)
        .set(updateData)
        .where(eq(tickets.id, ticketId))
        .returning();

      if (!ticketUpdated)
        throw new Error("Failed to update ticket status");

      // Outbox event for worker (Slack + email notifications)
      await tx.insert(outbox).values({
        event_type: "ticket.status.updated",
        payload: {
          ticket_id: ticketId,
          old_status: currentStatusValue,
          new_status: newStatus,
          updated_by_clerk_id: userId,
        },
      });

      return ticketUpdated;
    });

    // Check if ticket belongs to a group and if all tickets in that group are now closed
    // If so, archive the group
    if (ticket.group_id) {
      const { checkAndArchiveGroupIfAllTicketsClosed } = await import("@/lib/archive/group-archive");
      await checkAndArchiveGroupIfAllTicketsClosed(ticket.group_id);
    }

    return NextResponse.json(
      { success: true, ticket: updatedTicket },
      { status: 200 }
    );
  } catch (err) {
    console.error("Status update failed:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
