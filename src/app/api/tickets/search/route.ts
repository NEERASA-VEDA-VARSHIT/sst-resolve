import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tickets, users, staff, categories } from "@/db/schema";
import { and, eq, gte, lte, like, or, sql } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";

/**
 * ============================================
 * /api/tickets/search
 * ============================================
 * 
 * GET → Search/Filter Tickets (Admin only)
 *   - Auth: Required (Admin+)
 *   - Query Parameters:
 *     • query: Text search in description
 *     • status: Filter by status
 *     • category: Filter by category ID
 *     • assignedTo: Filter by staff UUID
 *     • createdBy: Filter by student UUID
 *     • dateFrom: ISO date
 *     • dateTo: ISO date
 *     • page: Page number
 *     • limit: Results per page
 *   - Returns: 200 OK with paginated search results
 * ============================================
 */

export async function GET(request: NextRequest) {
  try {
    // -----------------------
    // AUTH & ROLE CHECK
    // -----------------------
    const { userId } = await auth();
    if (!userId) {
      );
    }

    // -----------------------
    // QUERY PARAMS
    // -----------------------
    const url = new URL(request.url);
    const query = url.searchParams.get("query") ?? "";
    const status = url.searchParams.get("status") ?? "";
    const categoryId = url.searchParams.get("categoryId") ?? "";
    const assignedTo = url.searchParams.get("assignedTo") ?? "";
    const createdBy = url.searchParams.get("createdBy") ?? "";
    const dateFrom = url.searchParams.get("dateFrom") ?? "";
    const dateTo = url.searchParams.get("dateTo") ?? "";

    const page = Number(url.searchParams.get("page") ?? 1);
    const limit = Number(url.searchParams.get("limit") ?? 20);
    const offset = (page - 1) * limit;

    // -----------------------
    // BUILD FILTERS
    // -----------------------

    const filters = [];

    // Free-text search (indexed in Postgres)
    if (query) {
      filters.push(
        or(
          like(tickets.description, `%${query}%`),
          like(sql`CAST(${tickets.metadata} AS TEXT)`, `%${query}%`),
          like(tickets.location, `%${query}%`)
        )
      );
    }

    if (status) filters.push(eq(tickets.status, status));

    if (categoryId) filters.push(eq(tickets.category_id, Number(categoryId)));

    if (assignedTo) filters.push(eq(tickets.assigned_to, Number(assignedTo)));

    if (createdBy) filters.push(eq(tickets.created_by, Number(createdBy)));

    if (dateFrom) filters.push(gte(tickets.created_at, new Date(dateFrom)));

    if (dateTo) filters.push(lte(tickets.created_at, new Date(dateTo)));

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    // -----------------------
    // MAIN QUERY
    // -----------------------
    const rows = await db
      .select({
        id: tickets.id,
        status: tickets.status,
        categoryId: tickets.category_id,
        createdAt: tickets.created_at,
        updatedAt: tickets.updated_at,
        description: tickets.description,
        location: tickets.location,
        metadata: tickets.metadata,
        assignedTo: tickets.assigned_to,
        createdBy: tickets.created_by,
      })
      .from(tickets)
      .where(whereClause ?? undefined)
      .limit(limit)
      .offset(offset)
      .orderBy(tickets.created_at);

    // -----------------------
    // COUNT FOR PAGINATION
    // -----------------------
    const [{ count }] = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(tickets)
      .where(whereClause ?? undefined);

    return NextResponse.json({
      page,
      limit,
      total: count,
      results: rows,
    });
  } catch (err) {
    console.error("Ticket search failed:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
