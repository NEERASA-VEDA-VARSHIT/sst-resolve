import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tickets, users, staff, categories, hostels } from "@/db/schema";
import { desc, eq, and, isNull, or, sql, count, leftJoin } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";

/**
 * ============================================
 * /api/tickets/admin
 * ============================================
 *
 * GET → Admin Ticket Listing (Admin/SuperAdmin)
 *   - Auth: Required (Admin+)
 *   - Query Parameters:
 *     • page: Page number (default: 1)
 *     • limit: Results per page (default: 20)
 *     • status: Filter by status
 *     • category: Filter by category ID
 *     • assignedTo: Filter by staff ID
 *     • search: Text search in description/location
 *   - Returns: 200 OK with comprehensive ticket data including joins
 * ============================================
 */

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = await getUserRoleFromDB(userId);
    const isAdmin = role === "admin" || role === "super_admin";

    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    // Query params
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") || 1);
    const limit = Number(searchParams.get("limit") || 20);
    const offset = (page - 1) * limit;
    const status = searchParams.get("status") || "";
    const category = searchParams.get("category") || "";
    const assignedTo = searchParams.get("assignedTo") || "";
    const search = searchParams.get("search") || "";

    // Build filters
    const filters = [];

    // Only allow known ticket status enum values to satisfy Drizzle's typing
    const allowedStatuses = ['OPEN', 'IN_PROGRESS', 'AWAITING_STUDENT', 'REOPENED', 'ESCALATED', 'RESOLVED'] as const;
    type TicketStatus = typeof allowedStatuses[number];

    if (status && (allowedStatuses as readonly string[]).includes(status)) {
      filters.push(eq(tickets.status, status as TicketStatus));
    }
    if (category) filters.push(eq(tickets.category_id, Number(category)));
    if (assignedTo) filters.push(eq(tickets.assigned_to, Number(assignedTo)));
    if (search) {
      filters.push(
        or(
          sql`${tickets.description} ILIKE ${`%${search}%`}`,
          sql`${tickets.location} ILIKE ${`%${search}%`}`
        )
      );
    }

    // Role-based filtering
    if (role === "admin") {
      // Admins only see assigned tickets + unassigned
      const [userRow] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerk_id, userId))
        .limit(1);

      if (!userRow) return NextResponse.json({ error: "User not found" }, { status: 404 });

      const [staffRow] = await db
        .select({ id: staff.id })
        .from(staff)
        .where(eq(staff.user_id, userRow.id))
        .limit(1);

      if (!staffRow) return NextResponse.json({ error: "Staff profile not found" }, { status: 404 });

      // Assigned to this admin OR unassigned
      filters.push(
        or(
          eq(tickets.assigned_to, staffRow.id),
          isNull(tickets.assigned_to)
        )
      );
    }
    // Super admin sees all tickets (no additional filters needed)

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    // Main query with all necessary joins
    const ticketRows = await db
      .select({
        // Ticket fields
        id: tickets.id,
        status: tickets.status,
        description: tickets.description,
        location: tickets.location,
        created_at: tickets.created_at,
        updated_at: tickets.updated_at,
        due_at: tickets.due_at,
        escalation_level: tickets.escalation_level,
        metadata: tickets.metadata,
        attachments: tickets.attachments,

        // Creator info
        creator_name: users.name,
        creator_email: users.email,

        // Category info
        category_name: categories.name,
        category_slug: categories.slug,

        // Assigned staff info
        assigned_staff_name: staff.full_name,
        assigned_staff_email: staff.email,
      })
      .from(tickets)
      .leftJoin(users, eq(users.id, tickets.created_by))
      .leftJoin(categories, eq(categories.id, tickets.category_id))
      .leftJoin(staff, eq(staff.id, tickets.assigned_to))
      .where(whereClause ?? undefined)
      .orderBy(desc(tickets.created_at))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const [{ total }] = await db
      .select({
        total: sql<number>`COUNT(*)`,
      })
      .from(tickets)
      .where(whereClause ?? undefined);

    // Transform data for frontend
    const ticketsData = ticketRows.map(ticket => ({
      id: ticket.id,
      status: ticket.status,
      description: ticket.description,
      location: ticket.location,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      due_at: ticket.due_at,
      escalation_level: ticket.escalation_level,
      metadata: ticket.metadata,
      attachments: ticket.attachments,
      creator: {
        name: ticket.creator_name,
        email: ticket.creator_email,
      },
      category: {
        name: ticket.category_name,
        slug: ticket.category_slug,
      },
      assigned_to: ticket.assigned_staff_name ? {
        name: ticket.assigned_staff_name,
        email: ticket.assigned_staff_email,
      } : null,
    }));

    return NextResponse.json({
      page,
      limit,
      total,
      tickets: ticketsData,
    });

  } catch (error) {
    console.error("Admin ticket listing failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}