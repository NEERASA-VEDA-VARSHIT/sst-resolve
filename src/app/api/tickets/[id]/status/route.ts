import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tickets, outbox, ticket_committee_tags, committees, ticket_statuses, ticket_groups } from "@/db/schema";
import { getStatusIdByValue } from "@/lib/status/getTicketStatuses";
import type { TicketInsert } from "@/db/inferred-types";
import { eq, and, inArray } from "drizzle-orm";
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
 *     • Committee: Admin-like control, but ONLY for tickets tagged to their committee
 *     • Student: Can reopen their own closed/resolved tickets and "close" (self-resolve) their own active tickets
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

    let newStatus = parsed.data.status;

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

    // Students → can "close" (self-resolve) their own active tickets, or reopen their own resolved/closed tickets
    if (isStudent) {
      const currentCanonical = getCanonicalStatus(ticket.status) || null;

      if (ticket.created_by !== localUser.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const isReopening = newStatus === TICKET_STATUS.REOPENED;
      const isClosing = newStatus === TICKET_STATUS.CLOSED || newStatus === TICKET_STATUS.RESOLVED;

      const canReopen = currentCanonical === TICKET_STATUS.RESOLVED || currentCanonical === TICKET_STATUS.CLOSED;
      const canCloseFrom = new Set<string>([
        TICKET_STATUS.OPEN,
        TICKET_STATUS.IN_PROGRESS,
        TICKET_STATUS.AWAITING_STUDENT,
        TICKET_STATUS.REOPENED,
      ]);

      const canClose = currentCanonical ? canCloseFrom.has(currentCanonical) : false;

      if ((isReopening && canReopen) || (isClosing && canClose)) {
        // Allowed
      } else {
        return NextResponse.json(
          { error: "Students can only close their own active tickets or reopen closed/resolved tickets" },
          { status: 403 }
        );
      }
    }

    // Committee → can act like admins, but ONLY for tickets tagged to their committee or in groups assigned to their committee
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

      // Check direct tags
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
        // Check if ticket is in a group assigned to their committee
        if (ticket.group_id) {
          const [group] = await db
            .select({ committee_id: ticket_groups.committee_id })
            .from(ticket_groups)
            .where(eq(ticket_groups.id, ticket.group_id))
            .limit(1);

          if (!group?.committee_id || !committeeIds.includes(group.committee_id)) {
            return NextResponse.json(
              { error: "You can only update tickets tagged to your committee or in groups assigned to your committee" },
              { status: 403 }
            );
          }
        } else {
          return NextResponse.json(
            { error: "You can only update tickets tagged to your committee or in groups assigned to your committee" },
            { status: 403 }
          );
        }
      }
      // No further restriction on newStatus here: committees have admin-like control on their tickets
    }

    // Admin → can change status freely
    if (!isAdmin && !isStudent && !isCommittee) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // -------------------------
    // STATUS TRANSITION RULES
    // -------------------------

    // Validate status transitions - prevent invalid transitions
    const currentStatusValue = ticket.status || "";
    const currentCanonicalStatus = getCanonicalStatus(currentStatusValue) || currentStatusValue.toLowerCase();
    
    // Edge case: Prevent invalid transitions (e.g., resolved/closed -> open should be reopened)
    if ((currentCanonicalStatus === TICKET_STATUS.RESOLVED || currentCanonicalStatus === TICKET_STATUS.CLOSED) && newStatus === TICKET_STATUS.OPEN) {
      // If trying to go from resolved to open, change to reopened instead
      const reopenedStatusId = await getStatusIdByValue(TICKET_STATUS.REOPENED);
      if (reopenedStatusId) {
        newStatus = TICKET_STATUS.REOPENED;
      } else {
        return NextResponse.json(
          { error: "Invalid status transition: Cannot change from resolved to open. Use 'reopened' instead." },
          { status: 400 }
        );
      }
    }

    // Handle TAT pause when status changes to AWAITING_STUDENT
    let metadata: Record<string, unknown> = {};
    if (ticket.metadata && typeof ticket.metadata === "object" && !Array.isArray(ticket.metadata)) {
      metadata = { ...(ticket.metadata as Record<string, unknown>) };
    }
    if (newStatus === TICKET_STATUS.AWAITING_STUDENT && currentCanonicalStatus !== TICKET_STATUS.AWAITING_STUDENT) {
      // Pause TAT - record pause start time
      metadata.tatPauseStart = new Date().toISOString();
      // Initialize paused duration if not exists
      if (!metadata.tatPausedDuration) {
        metadata.tatPausedDuration = 0;
      }
    }

    // Edge case: Validate status exists and is active before updating
    const newStatusId = await getStatusIdByValue(newStatus);
    if (!newStatusId) {
      return NextResponse.json(
        { error: `Invalid status: ${newStatus}. The status may have been deleted or is inactive.` },
        { status: 400 }
      );
    }
    
    // Edge case: Verify status is still active (may have been deactivated)
    const [statusRecord] = await db
      .select({ is_active: ticket_statuses.is_active })
      .from(ticket_statuses)
      .where(eq(ticket_statuses.id, newStatusId))
      .limit(1);
    
    if (!statusRecord || !statusRecord.is_active) {
      return NextResponse.json(
        { error: `Status "${newStatus}" is inactive and cannot be used. Please select a different status.` },
        { status: 400 }
      );
    }
    
    // Edge case: Validate current status still exists (may have been deleted)
    if (!currentCanonicalStatus) {
      const { logWarning } = await import("@/lib/monitoring/alerts");
      logWarning(
        "Ticket has invalid or deleted status",
        { ticketId, currentStatusValue, newStatus }
      );
    }
    
    // Edge case: Prevent updating ticket that was just deleted
    const [ticketStillExists] = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);
    
    if (!ticketStillExists) {
      return NextResponse.json(
        { error: "Ticket was deleted. Cannot update status." },
        { status: 404 }
      );
    }

    // SET TIMESTAMPS - Update metadata for resolved_at, closed_at and reopened_at
    if (newStatus === TICKET_STATUS.RESOLVED) {
      metadata.resolved_at = new Date().toISOString();
    }
    if (newStatus === TICKET_STATUS.CLOSED) {
      metadata.closed_at = new Date().toISOString();
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
    let updatedTicket;
    try {
      updatedTicket = await db.transaction(async (tx) => {
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
    } catch (transactionError) {
      console.error(`[Status Update] Transaction failed for ticket #${ticketId}:`, transactionError);
      
      // Handle specific transaction errors
      if (transactionError instanceof Error) {
        if (transactionError.message.includes('deadlock') || transactionError.message.includes('timeout')) {
          return NextResponse.json(
            { error: "Database operation timed out. Please try again." },
            { status: 503 }
          );
        }
        if (transactionError.message.includes('not found') || transactionError.message.includes('does not exist')) {
          return NextResponse.json(
            { error: "Ticket or related data not found. It may have been deleted." },
            { status: 404 }
          );
        }
      }
      
      // Re-throw for generic error handling
      throw transactionError;
    }

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
