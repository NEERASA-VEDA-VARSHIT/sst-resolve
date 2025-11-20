import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tickets, users, staff, outbox } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";
import { z } from "zod";

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

// Allowed statuses — enforce workflow from PRD v3
const StatusSchema = z.object({
  status: z.enum([
    "OPEN",
    "IN_PROGRESS",
    "AWAITING_STUDENT",
    "RESOLVED",
    "REOPENED",
    "ESCALATED",
  ]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // -------------------------
    // AUTH
    // -------------------------
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const ticketId = Number(params.id);
    if (isNaN(ticketId))
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });

    const body = await request.json();
    const parsed = StatusSchema.safeParse(body);
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
    const isAdmin =
      role === "admin" || role === "super_admin";
    const isStudent = role === "student";

    // -------------------------
    // LOAD TICKET
    // -------------------------
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket)
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

    // -------------------------
    // PERMISSIONS
    // -------------------------

    // Students → can ONLY reopen their own resolved ticket
    if (isStudent) {
      if (ticket.created_by !== localUser.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (ticket.status !== "RESOLVED" || newStatus !== "REOPENED") {
        return NextResponse.json(
          { error: "Students can only reopen resolved tickets" },
          { status: 403 }
        );
      }
    }

    // Committee → cannot update status (except via committee dashboard rules)
    if (role === "committee") {
      return NextResponse.json(
        { error: "Committee members cannot update status" },
        { status: 403 }
      );
    }

    // Admin → can change status freely
    if (!isAdmin && !isStudent) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // -------------------------
    // STATUS TRANSITION RULES
    // -------------------------

    const updateData: any = {
      status: newStatus,
      updated_at: new Date(),
    };

    // SET TIMESTAMPS
    if (newStatus === "RESOLVED") {
      updateData.resolved_at = new Date();
    }
    if (newStatus === "REOPENED") {
      updateData.reopened_at = new Date();
    }

    // Admin taking action → assign the ticket to themselves automatically
    if (isAdmin) {
      const [staffRow] = await db
        .select({ id: staff.id })
        .from(staff)
        .where(eq(staff.user_id, localUser.id))
        .limit(1);

      if (staffRow) {
        updateData.assigned_to = staffRow.id;
      }
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
          old_status: ticket.status,
          new_status: newStatus,
          updated_by_clerk_id: userId,
        },
      });

      return ticketUpdated;
    });

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
