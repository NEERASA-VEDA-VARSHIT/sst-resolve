import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tickets, outbox, ticket_statuses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import { TICKET_STATUS, getCanonicalStatus } from "@/conf/constants";
import { EscalateTicketSchema } from "@/schemas/business/ticket";
import { getStatusIdByValue } from "@/lib/status/getTicketStatuses";

/**
 * ============================================
 * /api/tickets/[id]/escalate
 * ============================================
 * 
 * POST → Manual Escalation
 *   - Auth: Required
 *   - Permissions:
 *     • Student: Can escalate their own tickets
 *     • Admin: Can escalate any ticket
 *   - Behavior:
 *     • Increments escalation_level by 1
 *     • Updates escalated_at timestamp
 *     • Triggers worker notifications (email/Slack)
 *   - Returns: 200 OK with updated ticket
 * ============================================
 */
//  → DB transaction safe
//  → Creates an outbox event for workers (no Slack/email here)
// ---------------------------------------------------------------
//

// Body schema: optional reason
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // --------------------------------------------------
    // AUTH
    // --------------------------------------------------
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const localUser = await getOrCreateUser(userId);
    if (!localUser)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    const role = await getUserRoleFromDB(userId);
    const isAdmin =
      role === "admin" || role === "super_admin";
    const isStudent = role === "student";

    // --------------------------------------------------
    // PARAMS
    // --------------------------------------------------
    const { id } = await params;
    const ticketId = Number(id);
    if (isNaN(ticketId))
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const parsed = EscalateTicketSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.format() },
        { status: 400 }
      );

    const reason = parsed.data.reason || null;

    // --------------------------------------------------
    // LOAD TICKET
    // --------------------------------------------------
    const [ticketRow] = await db
      .select({
        id: tickets.id,
        title: tickets.title,
        description: tickets.description,
        location: tickets.location,
        status_id: tickets.status_id,
        status_value: ticket_statuses.value,
        category_id: tickets.category_id,
        subcategory_id: tickets.subcategory_id,
        sub_subcategory_id: tickets.sub_subcategory_id,
        created_by: tickets.created_by,
        assigned_to: tickets.assigned_to,
        group_id: tickets.group_id,
        escalation_level: tickets.escalation_level,
        acknowledgement_due_at: tickets.acknowledgement_due_at,
        resolution_due_at: tickets.resolution_due_at,
        metadata: tickets.metadata,
        created_at: tickets.created_at,
        updated_at: tickets.updated_at,
      })
      .from(tickets)
      .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticketRow)
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

    // --------------------------------------------------
    // PERMISSION RULES (PRD v3)
    // --------------------------------------------------

    // STUDENT → may escalate only their own unresolved tickets
    if (isStudent) {
      if (ticketRow.created_by !== localUser.id) {
        return NextResponse.json(
          { error: "You can only escalate your own tickets" },
          { status: 403 }
        );
      }

      const currentStatus = getCanonicalStatus(ticketRow.status_value || "");
      if (currentStatus === TICKET_STATUS.RESOLVED) {
        return NextResponse.json(
          { error: "Cannot escalate a resolved ticket" },
          { status: 400 }
        );
      }
    }

    // COMMITTEE → cannot escalate
    if (role === "committee") {
      return NextResponse.json(
        { error: "Committee members cannot escalate tickets" },
        { status: 403 }
      );
    }

    // ADMINS → can escalate any ticket except already resolved
    if (isAdmin) {
      const currentStatus = getCanonicalStatus(ticketRow.status_value || "");
      if (currentStatus === TICKET_STATUS.RESOLVED) {
        return NextResponse.json(
          { error: "Cannot escalate a resolved ticket" },
          { status: 400 }
        );
      }
    }

    // --------------------------------------------------
    // BUSINESS LOGIC
    // - Increase escalation_level
    // - Change status to ESCALATED
    // - Timestamp last_escalation_at
    // - Worker decides next escalation target (via outbox event)
    // --------------------------------------------------

    const newEscalationLevel = (ticketRow.escalation_level || 0) + 1;
    
    // Get status ID for ESCALATED status
    const escalatedStatusId = await getStatusIdByValue(TICKET_STATUS.ESCALATED);
    if (!escalatedStatusId) {
      return NextResponse.json(
        { error: "Escalated status not found in database" },
        { status: 500 }
      );
    }

    const updatedTicket = await db.transaction(async (tx) => {
      // Update metadata to track last escalation
      const metadata = (ticketRow.metadata && typeof ticketRow.metadata === 'object' && !Array.isArray(ticketRow.metadata))
        ? { ...ticketRow.metadata as Record<string, unknown> }
        : {};
      metadata.last_escalation_at = new Date().toISOString();

      // Update ticket
      const [t] = await tx
        .update(tickets)
        .set({
          escalation_level: newEscalationLevel,
          status_id: escalatedStatusId,
          metadata: metadata,
          updated_at: new Date(),
        })
        .where(eq(tickets.id, ticketId))
        .returning();

      if (!t) throw new Error("Failed to update ticket during escalation");

      // Insert outbox event to process notifications + escalation chain
      await tx.insert(outbox).values({
        event_type: "ticket.escalated.manual",
        payload: {
          ticket_id: ticketId,
          escalated_by_clerk_id: userId,
          escalated_by_role: role,
          previous_status: ticketRow.status_value || "",
          new_status: TICKET_STATUS.ESCALATED,
          new_escalation_level: newEscalationLevel,
          reason,
        },
      });

      return t;
    });

    return NextResponse.json(
      {
        success: true,
        message: "Ticket escalated successfully",
        ticket: updatedTicket,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error escalating ticket:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
