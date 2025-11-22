import { auth } from "@clerk/nextjs/server";
import { db, tickets, users, categories, subcategories, sub_subcategories, ticket_statuses } from "@/db";
import { eq, ilike, and, or, sql, asc, desc } from "drizzle-orm";

import { TicketCard } from "@/components/layout/TicketCard";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { getOrCreateUser } from "@/lib/user-sync";
import { TicketSearchWrapper } from "@/components/student/TicketSearchWrapper";
import { getCategoriesHierarchy } from "@/lib/filters/getCategoriesHierarchy";
import { getTicketStatuses } from "@/lib/status/getTicketStatuses";

export default async function StudentDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  // -----------------------------
  // 1. Auth + Get DB User
  // -----------------------------
  const { userId } = await auth();
  const dbUser = await getOrCreateUser(userId!);

  if (!dbUser) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-destructive">Account Error</h2>
          <p className="text-muted-foreground">
            Your account could not be found. Please contact support.
          </p>
        </div>
      </div>
    );
  }

  // -----------------------------
  // 2. Parse URL params
  // -----------------------------
  const params = (await searchParams) ?? {};
  const search = params.search ?? "";
  const statusFilter = params.status ?? "";
  const categoryFilter = params.category ?? "";
  const subcategoryFilter = params.subcategory ?? "";
  const subSubcategoryFilter = params.sub_subcategory ?? "";
  const sortBy = params.sort ?? "newest";

  // -----------------------------
  // 3. Build SQL conditions
  // -----------------------------
  const conditions = [eq(tickets.created_by, dbUser.id)];

  // Search
  if (search) {
    const value = `%${search}%`;
    const searchConditions = [
      ilike(tickets.description, value),
      ilike(categories.name, value),
      sql`tickets.id::text ILIKE ${value}`,
    ].filter(Boolean);

    if (searchConditions.length > 0) {
      conditions.push(or(...searchConditions)!);
    }
  }

  // Status Filter - use status_id from ticket_statuses table
  if (statusFilter) {
    const s = statusFilter.toUpperCase();

    if (s === "ESCALATED") {
      conditions.push(sql`${tickets.escalation_level} > 0`);
    } else {
      // Filter by status value using the join (ticket_statuses is joined in main query)
      conditions.push(eq(ticket_statuses.value, s));
    }
  }

  // Category Filter (slug-based)
  if (categoryFilter) {
    conditions.push(ilike(categories.slug, categoryFilter.toLowerCase()));
  }

  // Subcategory and Sub-subcategory Filters - fetch in parallel
  const [subcategoryResult, subSubcategoryResult] = await Promise.all([
    subcategoryFilter
      ? db
          .select({ id: subcategories.id })
          .from(subcategories)
          .where(eq(subcategories.slug, subcategoryFilter))
          .limit(1)
      : Promise.resolve([]),
    subSubcategoryFilter
      ? db
          .select({ id: sub_subcategories.id })
          .from(sub_subcategories)
          .where(eq(sub_subcategories.slug, subSubcategoryFilter))
          .limit(1)
      : Promise.resolve([]),
  ]);

  if (subcategoryResult.length > 0) {
    conditions.push(sql`metadata->>'subcategoryId' = ${String(subcategoryResult[0].id)}`);
  }

  if (subSubcategoryResult.length > 0) {
    conditions.push(sql`metadata->>'subSubcategoryId' = ${String(subSubcategoryResult[0].id)}`);
  }

  // Dynamic Field Filters (f_ prefix)
  const dynamicFilters = Object.entries(params).filter(([key]) => key.startsWith("f_"));

  for (const [key, value] of dynamicFilters) {
    if (typeof value === 'string' && value) {
      const fieldSlug = key.replace("f_", "");
      // Query: metadata->'dynamic_fields'->fieldSlug->>'value' = value
      // We use sql injection safe parameterization
      conditions.push(sql`metadata->'dynamic_fields'->${fieldSlug}->>'value' = ${value}`);
    }
  }

  // -----------------------------
  // 4. SQL Sorting
  // -----------------------------
  let orderBy: ReturnType<typeof desc> | ReturnType<typeof asc> | undefined;

  switch (sortBy) {
    case "oldest":
      orderBy = asc(tickets.created_at);
      break;

    case "due-date":
      orderBy = asc(tickets.resolution_due_at);
      break;

    case "status":
      orderBy = sql`
        CASE 
          WHEN ${ticket_statuses.value}='OPEN' THEN 1
          WHEN ${ticket_statuses.value}='IN_PROGRESS' THEN 2
          WHEN ${ticket_statuses.value}='AWAITING_STUDENT_RESPONSE' THEN 3
          WHEN ${ticket_statuses.value}='REOPENED' THEN 4
          WHEN ${ticket_statuses.value}='ESCALATED' THEN 5
          WHEN ${ticket_statuses.value}='RESOLVED' THEN 6
        END
      `;
      break;

    default:
      orderBy = desc(tickets.created_at);
  }

  // -----------------------------
  // 5. Fetch Filtered Tickets (with LIMIT to prevent timeouts)
  // -----------------------------
  const TICKET_LIMIT = 100; // Limit to prevent timeouts on large datasets
  const allTicketsRaw = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      description: tickets.description,
      location: tickets.location,
      status_id: tickets.status_id,
      category_id: tickets.category_id,
      subcategory_id: tickets.subcategory_id,
      sub_subcategory_id: tickets.sub_subcategory_id,
      created_by: tickets.created_by,
      assigned_to: tickets.assigned_to,
      acknowledged_by: tickets.acknowledged_by,
      group_id: tickets.group_id,
      escalation_level: tickets.escalation_level,
      tat_extended_count: tickets.tat_extended_count,
      last_escalation_at: tickets.last_escalation_at,
      acknowledgement_tat_hours: tickets.acknowledgement_tat_hours,
      resolution_tat_hours: tickets.resolution_tat_hours,
      acknowledgement_due_at: tickets.acknowledgement_due_at,
      resolution_due_at: tickets.resolution_due_at,
      acknowledged_at: tickets.acknowledged_at,
      reopened_at: tickets.reopened_at,
      sla_breached_at: tickets.sla_breached_at,
      reopen_count: tickets.reopen_count,
      rating: tickets.rating,
      feedback_type: tickets.feedback_type,
      rating_submitted: tickets.rating_submitted,
      feedback: tickets.feedback,
      is_public: tickets.is_public,
      admin_link: tickets.admin_link,
      student_link: tickets.student_link,
      slack_thread_id: tickets.slack_thread_id,
      external_ref: tickets.external_ref,
      metadata: tickets.metadata,
      created_at: tickets.created_at,
      updated_at: tickets.updated_at,
      resolved_at: tickets.resolved_at,
      status: ticket_statuses.value,
      category_name: categories.name,
      creator_first_name: users.first_name,
      creator_last_name: users.last_name,
      creator_email: users.email,
    })
    .from(tickets)
    .leftJoin(categories, eq(tickets.category_id, categories.id))
    .leftJoin(users, eq(tickets.created_by, users.id))
    .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(TICKET_LIMIT);
  
  // Map to TicketCard format
  const allTickets = allTicketsRaw.map(ticket => ({
    ...ticket,
    creator_name: [ticket.creator_first_name, ticket.creator_last_name].filter(Boolean).join(' ').trim() || null,
  }));

  // -----------------------------
  // 6. Stats Query (Optimized) - using status_id joins
  // -----------------------------
  const statsResult = await db
    .select({
      total: sql<number>`COUNT(*)`,
      open: sql<number>`SUM(CASE WHEN ${ticket_statuses.value}='OPEN' THEN 1 ELSE 0 END)`,
      inProgress: sql<number>`SUM(CASE WHEN ${ticket_statuses.value} IN ('IN_PROGRESS','ESCALATED') THEN 1 ELSE 0 END)`,
      awaitingStudent: sql<number>`SUM(CASE WHEN ${ticket_statuses.value}='AWAITING_STUDENT_RESPONSE' THEN 1 ELSE 0 END)`,
      resolved: sql<number>`SUM(CASE WHEN ${ticket_statuses.value}='RESOLVED' THEN 1 ELSE 0 END)`,
      escalated: sql<number>`SUM(CASE WHEN ${tickets.escalation_level} > 0 THEN 1 ELSE 0 END)`,
    })
    .from(tickets)
    .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
    .where(eq(tickets.created_by, dbUser.id));

  const stats = statsResult[0];

  // -----------------------------
  // Fetch categories hierarchy and statuses for search UI
  // -----------------------------
  const [categoryList, ticketStatuses] = await Promise.all([
    getCategoriesHierarchy(),
    getTicketStatuses(),
  ]);

  // -----------------------------
  // 7. UI Render
  // -----------------------------
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            My Tickets
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage and track all your support tickets
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/student/dashboard/ticket/new">
            <Button className="shadow-md hover:shadow-lg transition-shadow">
              <Plus className="w-4 h-4 mr-2" />
              New Ticket
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      {stats.total > 0 && <StatsCards stats={stats} />}

      {/* Search + Filters */}
      <Card className="border-2">
        <CardContent className="p-6">
          <TicketSearchWrapper
            categories={categoryList}
            currentSort={sortBy}
            statuses={ticketStatuses}
          />
        </CardContent>
      </Card>

      {/* No Tickets */}
      {allTickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed rounded-lg bg-muted/30">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
              <Plus className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No tickets yet</h3>
            <p className="text-muted-foreground max-w-sm">
              Get started by creating your first support ticket. We&apos;re here to
              help!
            </p>
            <Link
              href="/student/dashboard/ticket/new"
              className="inline-block mt-4"
            >
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Ticket
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {allTickets.map((ticket) => (
            <TicketCard 
              key={ticket.id} 
              ticket={ticket} 
            />
          ))}
        </div>
      )}
    </div>
  );
}
