import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, tickets, ticket_groups } from "@/db";
import { eq, inArray, desc } from "drizzle-orm";
import { getOrCreateUser } from "@/lib/user-sync";
import { getUserRoleFromDB } from "@/lib/db-roles";

/**
 * ============================================
 * /api/tickets/groups
 * ============================================
 * 
 * POST → Create Ticket Group
 *   - Auth: Required (Admin only)
 *   - Group multiple tickets together for bulk management
 *   - Body: { name: string, ticketIds: number[], description: string (optional) }
 *   - Use Case: Handle related tickets together (e.g., hostel-wide issue)
 *   - Returns: 201 Created with group object
 * 
 * GET → List Ticket Groups
 *   - Auth: Required (Admin only)
 *   - List all ticket groups with ticket counts
 *   - Returns: 200 OK with array of groups
 * ============================================
 */

// POST - Create a new ticket group and add tickets to it
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
    
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "Only admins and super admins can create ticket groups" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, ticketIds } = body;

    if (!name || !ticketIds || !Array.isArray(ticketIds) || ticketIds.length === 0) {
      return NextResponse.json({ error: "Group name and at least one ticket ID are required" }, { status: 400 });
    }

    // Ensure user exists in database
    const dbUser = await getOrCreateUser(userId);

    // Create the group
    const [newGroup] = await db
      .insert(ticket_groups)
      .values({
        name,
        description: description || null,
        created_by: dbUser.id,
      })
      .returning();

    // Add tickets to the group
    await db
      .update(tickets)
      .set({ group_id: newGroup.id })
      .where(inArray(tickets.id, ticketIds));

    // Fetch updated tickets
    const updatedTickets = await db
      .select()
      .from(tickets)
      .where(inArray(tickets.id, ticketIds));

    return NextResponse.json({
      group: newGroup,
      tickets: updatedTickets,
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating ticket group:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// GET - Get all ticket groups with their tickets
export async function GET(request: NextRequest) {
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

    const groups = await db
      .select()
      .from(ticket_groups)
      .orderBy(desc(ticket_groups.created_at));

    // Fetch tickets for each group
    const groupsWithTickets = await Promise.all(
      groups.map(async (group) => {
        const groupTickets = await db
          .select()
          .from(tickets)
          .where(eq(tickets.group_id, group.id));
        
        return {
          ...group,
          tickets: groupTickets,
          ticketCount: groupTickets.length,
        };
      })
    );

    return NextResponse.json({ groups: groupsWithTickets });
  } catch (error) {
    console.error("Error fetching ticket groups:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

