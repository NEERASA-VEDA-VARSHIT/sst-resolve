import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tickets, outbox, ticket_statuses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";
import { TICKET_STATUS } from "@/conf/constants";
import { getStatusIdByValue } from "@/lib/status-helpers";

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
const EscalateSchema = z.object({
  reason: z.string().max(2000).optional(),
});

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
    const parsed = EscalateSchema.safeParse(body);
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
        category_id: tickets.category_id,
        subcategory_id: tickets.subcategory_id,
        sub_subcategory_id: tickets.sub_subcategory_id,
        created_by: tickets.created_by,
        assigned_to: tickets.assigned_to,
        acknowledged_by: tickets.acknowledged_by,
        group_id: tickets.group_id,
        escalation_level: tickets.escalation_level,
        tat_extended_count: tickets.tat_extended_count,
        last_escalation_at: tickets.last_escalation_at,
        acknowledgement_tat_hours: tickets.acknowledgement_tat_hours,
        resolution_tat_hours: tickets.resolution_tat_hours,
        acknowledgement_due_at: tickets.acknowledgement_due_at,
        resolution_due_at: tickets.resolution_due_at,
        acknowledged_at: tickets.acknowledged_at,
        reopened_at: tickets.reopened_at,
        sla_breached_at: tickets.sla_breached_at,
        reopen_count: tickets.reopen_count,
        rating: tickets.rating,
        feedback_type: tickets.feedback_type,
        rating_submitted: tickets.rating_submitted,
        feedback: tickets.feedback,
        is_public: tickets.is_public,
        admin_link: tickets.admin_link,
        student_link: tickets.student_link,
        slack_thread_id: tickets.slack_thread_id,
        external_ref: tickets.external_ref,
        metadata: tickets.metadata,
        created_at: tickets.created_at,
        updated_at: tickets.updated_at,
        resolved_at: tickets.resolved_at,
        status_value: ticket_statuses.value,
      })
      .from(tickets)
      .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticketRow)
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

    const ticket = {
      ...ticketRow,
      status: ticketRow.status_value || null,
    };

    // --------------------------------------------------
    // PERMISSION RULES (PRD v3)
    // --------------------------------------------------

    // STUDENT → may escalate only their own unresolved tickets
    if (isStudent) {
      if (ticket.created_by !== localUser.id) {
        return NextResponse.json(
          { error: "You can only escalate your own tickets" },
          { status: 403 }
        );
      }

      if ((ticket.status || "").toUpperCase() === TICKET_STATUS.RESOLVED) {
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
      if ((ticket.status || "").toUpperCase() === TICKET_STATUS.RESOLVED) {
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

    const newEscalationLevel = (ticket.escalation_level || 0) + 1;

    // Get the status ID for ESCALATED
    const escalatedStatusId = await getStatusIdByValue(TICKET_STATUS.ESCALATED);
    if (!escalatedStatusId) {
      return NextResponse.json(
        { error: "ESCALATED status not found in database" },
        { status: 500 }
      );
    }

    const updatedTicket = await db.transaction(async (tx) => {
      // Update ticket
      const [t] = await tx
        .update(tickets)
        .set({
          escalation_level: newEscalationLevel,
          status_id: escalatedStatusId,
          last_escalation_at: new Date(),
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
          previous_status: ticket.status,
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
