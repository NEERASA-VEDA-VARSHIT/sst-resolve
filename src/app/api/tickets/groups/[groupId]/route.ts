import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, tickets, ticket_groups } from "@/db";
import { eq, inArray } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";

/**
 * ============================================
 * /api/tickets/groups/[groupId]
 * ============================================
 * 
 * GET → Get Specific Ticket Group
 *   - Auth: Required (Admin only)
 *   - Fetch group with all associated tickets
 *   - Returns: 200 OK with group object including tickets array
 * 
 * PATCH → Update Ticket Group
 *   - Auth: Required (Admin only)
 *   - Update group name, description, or add/remove tickets
 *   - Body: { name: string, description: string, ticketIds: number[] }
 *   - Returns: 200 OK with updated group
 * 
 * DELETE → Delete Ticket Group
 *   - Auth: Required (Admin only)
 *   - Remove group (tickets remain, just ungroup them)
 *   - Returns: 200 OK with success message
 * ============================================
 */

// GET - Get a specific ticket group with its tickets
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user exists in database
    await getOrCreateUser(userId);

    // Get role from database (single source of truth)
    const role = await getUserRoleFromDB(userId);
    
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "Only admins and super admins can view ticket groups" }, { status: 403 });
    }

    const { groupId } = await params;
    const groupIdNum = parseInt(groupId, 10);

    if (isNaN(groupIdNum)) {
      return NextResponse.json({ error: "Invalid group ID" }, { status: 400 });
    }

    const [group] = await db
      .select()
      .from(ticket_groups)
      .where(eq(ticket_groups.id, groupIdNum))
      .limit(1);

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const groupTickets = await db
      .select()
      .from(tickets)
      .where(eq(tickets.group_id, groupIdNum));

    return NextResponse.json({
      ...group,
      tickets: groupTickets,
      ticketCount: groupTickets.length,
    });
  } catch (error) {
    console.error("Error fetching ticket group:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PATCH - Update group (add/remove tickets or update group info)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user exists in database
    await getOrCreateUser(userId);

    // Get role from database (single source of truth)
    const role = await getUserRoleFromDB(userId);
    
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "Only admins and super admins can update ticket groups" }, { status: 403 });
    }

    const { groupId } = await params;
    const groupIdNum = parseInt(groupId, 10);

    if (isNaN(groupIdNum)) {
      return NextResponse.json({ error: "Invalid group ID" }, { status: 400 });
    }

    const body = await request.json();
    const { name, description, addTicketIds, removeTicketIds } = body;

    // Update group info if provided
    if (name || description !== undefined) {
      const updateData: Record<string, unknown> = {};
      if (name) updateData.name = name;
      if (description !== undefined) updateData.description = description || null;
      updateData.updated_at = new Date();

      await db
        .update(ticket_groups)
        .set(updateData)
        .where(eq(ticket_groups.id, groupIdNum));
    }

    // Add tickets to group
    if (addTicketIds && Array.isArray(addTicketIds) && addTicketIds.length > 0) {
      await db
        .update(tickets)
        .set({ group_id: groupIdNum })
        .where(inArray(tickets.id, addTicketIds));
    }

    // Remove tickets from group
    if (removeTicketIds && Array.isArray(removeTicketIds) && removeTicketIds.length > 0) {
      await db
        .update(tickets)
        .set({ group_id: null })
        .where(inArray(tickets.id, removeTicketIds));
    }

    // Fetch updated group
    const [updatedGroup] = await db
      .select()
      .from(ticket_groups)
      .where(eq(ticket_groups.id, groupIdNum))
      .limit(1);

    const groupTickets = await db
      .select()
      .from(tickets)
      .where(eq(tickets.group_id, groupIdNum));

    return NextResponse.json({
      ...updatedGroup,
      tickets: groupTickets,
      ticketCount: groupTickets.length,
    });
  } catch (error) {
    console.error("Error updating ticket group:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE - Delete a ticket group (ungroups all tickets)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user exists in database
    await getOrCreateUser(userId);

    // Get role from database (single source of truth)
    const role = await getUserRoleFromDB(userId);
    
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "Only admins and super admins can delete ticket groups" }, { status: 403 });
    }

    const { groupId } = await params;
    const groupIdNum = parseInt(groupId, 10);

    if (isNaN(groupIdNum)) {
      return NextResponse.json({ error: "Invalid group ID" }, { status: 400 });
    }

    // Remove group_id from all tickets in this group
    await db
      .update(tickets)
      .set({ group_id: null })
      .where(eq(tickets.group_id, groupIdNum));

    // Delete the group
    await db
      .delete(ticket_groups)
      .where(eq(ticket_groups.id, groupIdNum));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting ticket group:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

