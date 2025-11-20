import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tickets, staff, users, outbox } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";

/**
 * ============================================
 * /api/tickets/[id]/assign
 * ============================================
 * 
 * PATCH → Assign/Unassign Staff
 *   - Auth: Required (Admin only)
 *   - Assign or unassign SPOC/staff to a ticket
 *   - Set assignedTo to null to unassign
 *   - Returns: 200 OK with updated ticket
 * ============================================
 */

/**
 * Body Schema:
 * {
 *   "staffClerkId": "clerk_user_123"   // assign to specific staff member
 * }
 *
 * Passing null unassigns the ticket:
 * { "staffClerkId": null }
 */
const AssignSchema = z.object({
  staffClerkId: z.string().nullable(), // null → unassign
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authentication
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = AssignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.format() },
        { status: 400 }
      );
    }

    // Extract staffClerkId from request
    const staffClerkId = parsed.data.staffClerkId;

    // 2. Validate ticket ID
    const ticketId = Number(params.id);
    if (isNaN(ticketId))
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });

    // 3. Ensure local user exists
    const localUser = await getOrCreateUser(userId);
    if (!localUser)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    // 4. Check role permissions
    const role = await getUserRoleFromDB(userId);
    const isAdmin =
      role === "admin" || role === "super_admin";

    if (!isAdmin) {
      return NextResponse.json(
        { error: "You do not have permission to assign tickets" },
        { status: 403 }
      );
    }

    // 5. Load ticket
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket)
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

    // 6. Resolve staff ID if a new assignee is provided
    let assignedStaffId: number | null = null;

    if (staffClerkId !== null) {
      // Find DB user with the given clerkId
      const [staffUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerk_id, staffClerkId))
        .limit(1);

      if (!staffUser) {
        return NextResponse.json(
          { error: "No user found for provided staffClerkId" },
          { status: 404 }
        );
      }

      // Find staff entry for that user
      const [staffRow] = await db
        .select({ id: staff.id })
        .from(staff)
        .where(eq(staff.user_id, staffUser.id))
        .limit(1);

      if (!staffRow) {
        return NextResponse.json(
          { error: "User is not registered as staff" },
          { status: 400 }
        );
      }

      assignedStaffId = staffRow.id;
    }

    // 7. Update ticket & write outbox event
    const updatedTicket = await db.transaction(async (tx) => {
      // Update ticket assignment
      const [update] = await tx
        .update(tickets)
        .set({
          assigned_to: assignedStaffId,
          updated_at: new Date(),
        })
        .where(eq(tickets.id, ticketId))
        .returning();

      if (!update) throw new Error("Failed to update assignment");

      // Enqueue outbox event for worker to process notifications
      await tx.insert(outbox).values({
        event_type: "ticket.assignment.updated",
        payload: {
          ticket_id: ticketId,
          old_assignee: ticket.assigned_to,
          new_assignee: assignedStaffId,
          updated_by_clerk_id: userId,
        },
      });

      return update;
    });

    return NextResponse.json({ success: true, ticket: updatedTicket });
  } catch (err) {
    console.error("Error assigning ticket:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
