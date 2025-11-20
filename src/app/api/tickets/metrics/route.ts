import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tickets, categories } from "@/db/schema";
import { eq, inArray, sql, gte, and } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";

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
      );
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
      status: tickets.status,
      count: sql<number>`COUNT(*)`,
    })
    .from(tickets)
    .where(inArray(tickets.status, statusList))
    .groupBy(tickets.status);

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
  const [{ overdue }] = await db
    .select({
      overdue: sql<number>`
          COUNT(*) 
        `,
    })
    .from(tickets)
    .where(sql`status != 'RESOLVED' AND now() - created_at > interval '48 hours'`);

  // Reopened tickets count
  const [{ reopened }] = await db
    .select({
      reopened: sql<number>`COUNT(*)`,
    })
    .from(tickets)
    .where(eq(tickets.status, "REOPENED"));

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

  const [{ resolvedToday }] = await db
    .select({ resolvedToday: sql<number>`COUNT(*)` })
    .from(tickets)
    .where(
      and(
        eq(tickets.status, "RESOLVED"),
        gte(tickets.resolved_at, todayStartSQL)
      )
    );

  const [{ escalatedToday }] = await db
    .select({ escalatedToday: sql<number>`COUNT(*)` })
    .from(tickets)
    .where(
      and(
        eq(tickets.status, "ESCALATED"),
        gte(tickets.last_escalation_at, todayStartSQL)
      )
    );

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
