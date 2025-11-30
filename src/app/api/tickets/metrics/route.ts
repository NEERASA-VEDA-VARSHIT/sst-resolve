import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tickets, categories, ticket_statuses } from "@/db/schema";
import { eq, inArray, sql, gte, and, ne } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { TICKET_STATUS } from "@/conf/constants";
import { getStatusIdByValue } from "@/lib/status/getTicketStatuses";

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
    TICKET_STATUS.OPEN,
    TICKET_STATUS.IN_PROGRESS,
    TICKET_STATUS.AWAITING_STUDENT,
    TICKET_STATUS.RESOLVED,
    TICKET_STATUS.ESCALATED,
    TICKET_STATUS.REOPENED,
  ];

  // Get status IDs for the status list
  const statusIds: number[] = [];
  for (const statusValue of statusList) {
    const statusId = await getStatusIdByValue(statusValue);
    if (statusId) statusIds.push(statusId);
  }

  const statusCountsQuery = await db
    .select({
      status: ticket_statuses.value,
      count: sql<number>`COUNT(*)`,
    })
    .from(tickets)
    .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
    .where(inArray(tickets.status_id, statusIds))
    .groupBy(ticket_statuses.value);

  const statusCounts = Object.fromEntries(
    statusCountsQuery
      .filter((row) => row.status)
      .map((row) => [row.status!, row.count])
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
  // Average resolution time (in hours) - extract from metadata
  // Note: This is a simplified calculation. For production, you may want to query metadata JSONB
  const [{ avgResolutionHours }] = await db
    .select({
      avgResolutionHours: sql<number>`
          AVG(
            CASE 
              WHEN metadata->>'resolved_at' IS NOT NULL AND created_at IS NOT NULL
              THEN EXTRACT(EPOCH FROM ((metadata->>'resolved_at')::timestamp - created_at)) / 3600
              ELSE NULL
            END
          )
        `,
    })
    .from(tickets)
    .where(sql`metadata->>'resolved_at' IS NOT NULL`);

  // Overdue tickets: updated_at > 48h OR SLA custom logic
  const resolvedStatusId = await getStatusIdByValue(TICKET_STATUS.RESOLVED);
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

  const reopenedStatusId = await getStatusIdByValue(TICKET_STATUS.REOPENED);
  const [{ reopened }] = reopenedStatusId
    ? await db
        .select({
          reopened: sql<number>`COUNT(*)`,
        })
        .from(tickets)
        .where(eq(tickets.status_id, reopenedStatusId))
    : [{ reopened: 0 }];

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

  const resolvedStatusIdForToday = await getStatusIdByValue(TICKET_STATUS.RESOLVED);
  const [{ resolvedToday }] = resolvedStatusIdForToday
    ? await db
        .select({ resolvedToday: sql<number>`COUNT(*)` })
        .from(tickets)
        .where(
          and(
            eq(tickets.status_id, resolvedStatusIdForToday),
            sql`metadata->>'resolved_at' IS NOT NULL`,
            sql`(metadata->>'resolved_at')::timestamp >= ${todayStartSQL}`
          )
        )
    : [{ resolvedToday: 0 }];

  const escalatedStatusId = await getStatusIdByValue(TICKET_STATUS.ESCALATED);
  const [{ escalatedToday }] = escalatedStatusId
    ? await db
        .select({ escalatedToday: sql<number>`COUNT(*)` })
        .from(tickets)
        .where(
          and(
            eq(tickets.status_id, escalatedStatusId),
            sql`metadata->>'last_escalation_at' IS NOT NULL`,
            sql`(metadata->>'last_escalation_at')::timestamp >= ${todayStartSQL}`
          )
        )
    : [{ escalatedToday: 0 }];

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
