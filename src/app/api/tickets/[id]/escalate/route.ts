import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tickets, outbox } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";
import { TICKET_STATUS } from "@/conf/constants";

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
  { params }: { params: { id: string } }
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
    const ticketId = Number(params.id);
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
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket)
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

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

      if (ticket.status === TICKET_STATUS.RESOLVED) {
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
      if (ticket.status === TICKET_STATUS.RESOLVED) {
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

    const updatedTicket = await db.transaction(async (tx) => {
      // Update ticket
      const [t] = await tx
        .update(tickets)
        .set({
          escalation_level: newEscalationLevel,
          status: TICKET_STATUS.ESCALATED,
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
