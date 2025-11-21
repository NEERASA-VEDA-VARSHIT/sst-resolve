import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tickets, categories, ticket_statuses } from "@/db/schema";
import { eq, inArray, sql, gte, and, ne } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getStatusIdByValue } from "@/lib/status-helpers";

/**
 * ============================================
 * /api/tickets/metrics
 * ============================================
 * 
 * GET → Get Ticket Metrics (Admin only)
 *   - Auth: Required (Admin+)
 *   - Returns dashboard metrics:
 *     • Total ticket counts
 *     • Counts by status
 *     • Counts by category
 *     • SLA metrics (avg resolution time)
 *     • Overdue ticket count
 *     • Reopened ticket count
 *     • Today's stats (created, resolved)
 *   - Returns: 200 OK with metrics object
 * ============================================
 */

export async function GET() {
  try {
    // -------------------------------
    // AUTH
    // -------------------------------
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = await getUserRoleFromDB(userId);
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // -------------------------------
    // BASIC METRICS
    // -------------------------------
    const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)` })
    .from(tickets);

  const statusList = [
    "OPEN",
    "IN_PROGRESS",
    "AWAITING_STUDENT",
    "RESOLVED",
    "ESCALATED",
    "REOPENED",
  ];

  const statusCountsQuery = await db
    .select({
      status: ticket_statuses.value,
      count: sql<number>`COUNT(*)`,
    })
    .from(tickets)
    .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
    .where(inArray(ticket_statuses.value, statusList))
    .groupBy(ticket_statuses.value);

  const statusCounts = Object.fromEntries(
    statusCountsQuery.map((row) => [row.status, row.count])
  );

  // -------------------------------
  // CATEGORY BREAKDOWN
  // -------------------------------
  const categoryRows = await db
    .select({
      category_id: tickets.category_id,
      count: sql<number>`COUNT(*)`,
      name: categories.name,
    })
    .from(tickets)
    .leftJoin(categories, eq(tickets.category_id, categories.id))
    .groupBy(categories.id, categories.name);

  // -------------------------------
  // SLA METRICS
  // -------------------------------
  // Average resolution time (in hours)
  const [{ avgResolutionHours }] = await db
    .select({
      avgResolutionHours: sql<number>`
          AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)
        `,
    })
    .from(tickets)
    .where(sql`resolved_at IS NOT NULL`);

  // Overdue tickets: updated_at > 48h OR SLA custom logic
  // Get RESOLVED status ID to exclude resolved tickets
  const resolvedStatusId = await getStatusIdByValue("RESOLVED");
  const overdueWhere = resolvedStatusId
    ? and(
        ne(tickets.status_id, resolvedStatusId),
        sql`now() - ${tickets.created_at} > interval '48 hours'`
      )
    : sql`now() - ${tickets.created_at} > interval '48 hours'`;

  const [{ overdue }] = await db
    .select({
      overdue: sql<number>`COUNT(*)`,
    })
    .from(tickets)
    .where(overdueWhere);

  // Reopened tickets count
  const reopenedStatusId = await getStatusIdByValue("REOPENED");
  const reopenedWhere = reopenedStatusId
    ? eq(tickets.status_id, reopenedStatusId)
    : sql`1 = 0`; // Return 0 if status doesn't exist

  const [{ reopened }] = await db
    .select({
      reopened: sql<number>`COUNT(*)`,
    })
    .from(tickets)
    .where(reopenedWhere);

  // -------------------------------
  // TODAY'S METRICS
  // -------------------------------
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayStartSQL = sql`${todayStart.toISOString()}`;

  const [{ createdToday }] = await db
    .select({ createdToday: sql<number>`COUNT(*)` })
    .from(tickets)
    .where(gte(tickets.created_at, todayStartSQL));

  const resolvedStatusIdForToday = await getStatusIdByValue("RESOLVED");
  const resolvedTodayWhere = resolvedStatusIdForToday
    ? and(
        eq(tickets.status_id, resolvedStatusIdForToday),
        gte(tickets.resolved_at, todayStartSQL)
      )
    : sql`1 = 0`; // Return 0 if status doesn't exist

  const [{ resolvedToday }] = await db
    .select({ resolvedToday: sql<number>`COUNT(*)` })
    .from(tickets)
    .where(resolvedTodayWhere);

  const escalatedStatusId = await getStatusIdByValue("ESCALATED");
  const escalatedTodayWhere = escalatedStatusId
    ? and(
        eq(tickets.status_id, escalatedStatusId),
        gte(tickets.last_escalation_at, todayStartSQL)
      )
    : sql`1 = 0`; // Return 0 if status doesn't exist

  const [{ escalatedToday }] = await db
    .select({ escalatedToday: sql<number>`COUNT(*)` })
    .from(tickets)
    .where(escalatedTodayWhere);

  // -------------------------------
  // FINAL RESPONSE
  // -------------------------------
  return NextResponse.json(
    {
      totalTickets: total,
      statusCounts,
      categories: categoryRows,
      sla: {
        avgResolutionHours: avgResolutionHours || 0,
        overdue,
        reopened,
      },
      today: {
        createdToday,
        resolvedToday,
        escalatedToday,
      },
    },
    { status: 200 }
  );
} catch (err) {
  console.error("Metrics fetch failed:", err);
  return NextResponse.json(
    { error: "Internal Server Error" },
    { status: 500 }
  );
}
}
