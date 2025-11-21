import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, tickets, categories, users, ticket_statuses } from "@/db";
import { desc, eq, isNull, or, sql, count } from "drizzle-orm";
import type { TicketMetadata } from "@/db/types";
import { alias } from "drizzle-orm/pg-core";
import { TicketCard } from "@/components/layout/TicketCard";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { AdminTicketFilters } from "@/components/admin/AdminTicketFilters";
import { Button } from "@/components/ui/button";
import { FileText, Shield, Settings, Building2, Users, Calendar, AlertCircle, BarChart3 } from "lucide-react";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { PaginationControls } from "@/components/dashboard/PaginationControls";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";
import { normalizeStatusForComparison } from "@/lib/utils";

// Create alias for users table to use for assigned admin (unused but kept for potential future use)
// const assignedAdmin = alias(users, 'assigned_admin');

export default async function SuperAdminDashboardPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  // Ensure user exists in database
  const dbUser = await getOrCreateUser(userId);

  // Get role from database (single source of truth)
  const role = await getUserRoleFromDB(userId);

  if (role !== 'super_admin') {
    redirect('/student/dashboard');
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const params = resolvedSearchParams || {};
  const category = (typeof params["category"] === "string" ? params["category"] : params["category"]?.[0]) || "";
  const subcategory = (typeof params["subcategory"] === "string" ? params["subcategory"] : params["subcategory"]?.[0]) || "";
  const location = (typeof params["location"] === "string" ? params["location"] : params["location"]?.[0]) || "";
  const tat = (typeof params["tat"] === "string" ? params["tat"] : params["tat"]?.[0]) || "";
  const status = (typeof params["status"] === "string" ? params["status"] : params["status"]?.[0]) || "";
  const escalatedFilter = (typeof params["escalated"] === "string" ? params["escalated"] : params["escalated"]?.[0]) || "";
  const createdFrom = (typeof params["from"] === "string" ? params["from"] : params["from"]?.[0]) || "";
  const createdTo = (typeof params["to"] === "string" ? params["to"] : params["to"]?.[0]) || "";
  const user = (typeof params["user"] === "string" ? params["user"] : params["user"]?.[0]) || "";
  const sort = (typeof params["sort"] === "string" ? params["sort"] : params["sort"]?.[0]) || "newest";

  // Pagination
  const page = parseInt((typeof params["page"] === "string" ? params["page"] : params["page"]?.[0]) || "1", 10);
  const limit = 20; // Tickets per page
  const offsetValue = (page - 1) * limit;

  // Define where conditions for reuse
  // Super admin sees: unassigned tickets, tickets assigned to them, and escalated tickets
  const whereConditions = or(
    isNull(tickets.assigned_to), // Unassigned tickets
    dbUser ? eq(tickets.assigned_to, dbUser.id) : sql`false`, // Assigned to super admin
    sql`${tickets.escalation_level} > 0` // Escalated tickets
  );

  // Get total count of tickets matching the conditions (for pagination)
  let totalCount = 0;
  type TicketRowRaw = {
    id: number;
    title: string | null;
    description: string | null;
    location: string | null;
    status_id: number;
    status: string | null;
    category_id: number | null;
    subcategory_id: number | null;
    sub_subcategory_id: number | null;
    created_by: string;
    assigned_to: string | null;
    acknowledged_by: string | null;
    group_id: number | null;
    escalation_level: number;
    tat_extended_count: number;
    last_escalation_at: Date | null;
    acknowledgement_tat_hours: number | null;
    resolution_tat_hours: number | null;
    acknowledgement_due_at: Date | null;
    resolution_due_at: Date | null;
    acknowledged_at: Date | null;
    reopened_at: Date | null;
    sla_breached_at: Date | null;
    reopen_count: number;
    rating: number | null;
    feedback_type: string | null;
    rating_submitted: Date | null;
    feedback: string | null;
    is_public: boolean;
    admin_link: string | null;
    student_link: string | null;
    slack_thread_id: string | null;
    external_ref: string | null;
    metadata: unknown;
    created_at: Date;
    updated_at: Date;
    resolved_at: Date | null;
    category_name: string | null;
    creator_first_name: string | null;
    creator_last_name: string | null;
    creator_email: string | null;
  };
  type TicketRow = TicketRowRaw & {
    creator_name: string | null;
    assigned_staff_name?: string | null;
    assigned_staff_email?: string | null;
  };
  let ticketRows: TicketRow[] = [];
  try {
    const [totalResult] = await db
      .select({ count: count() })
      .from(tickets)
      .where(whereConditions);

    totalCount = totalResult?.count || 0;

    // Fetch tickets with joins for category and creator info
    // Note: We'll fetch assigned admin info separately to avoid alias issues
    const ticketRowsRaw: TicketRowRaw[] = await db
      .select({
        // All ticket columns explicitly
        id: tickets.id,
        title: tickets.title,
        description: tickets.description,
        location: tickets.location,
        status_id: tickets.status_id,
        status: ticket_statuses.value, // Get the actual status value from the joined table
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
        // Joined fields
        category_name: categories.name,
        creator_first_name: users.first_name,
        creator_last_name: users.last_name,
        creator_email: users.email,
      })
      .from(tickets)
      .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
      .leftJoin(categories, eq(tickets.category_id, categories.id))
      .leftJoin(users, eq(tickets.created_by, users.id))
      .where(whereConditions)
      .orderBy(desc(tickets.created_at))
      .limit(limit)
      .offset(offsetValue);

    // Fetch assigned admin info separately for tickets that have an assigned_to
    const assignedToIds = [...new Set(ticketRowsRaw.map(t => t.assigned_to).filter(Boolean))];
    type AdminInfo = {
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    };
    let assignedAdmins: Record<string, AdminInfo> = {};

    if (assignedToIds.length > 0) {
      const admins = await db
        .select({
          id: users.id,
          first_name: users.first_name,
          last_name: users.last_name,
          email: users.email,
        })
        .from(users)
        .where(sql`${users.id} IN ${assignedToIds}`);

      assignedAdmins = Object.fromEntries(
        admins.map(admin => [
          admin.id,
          {
            id: admin.id,
            first_name: admin.first_name || null,
            last_name: admin.last_name || null,
            email: admin.email
          }
        ])
      );
    }

    // Add assigned admin info to ticket rows
    ticketRows = ticketRowsRaw.map(row => ({
      ...row,
      creator_name: [row.creator_first_name, row.creator_last_name].filter(Boolean).join(" ").trim() || null,
      assigned_staff_name: row.assigned_to ? [assignedAdmins[row.assigned_to]?.first_name, assignedAdmins[row.assigned_to]?.last_name].filter(Boolean).join(" ").trim() : null,
      assigned_staff_email: row.assigned_to ? assignedAdmins[row.assigned_to]?.email : null,
    }));
  } catch (error) {
    console.error('[Super Admin Dashboard] Error fetching tickets/count:', error);
    throw new Error('Failed to load tickets for dashboard');
  }

  // Apply additional client-side filters not handled by API
  let filteredTickets = ticketRows;

  // Filter by escalated tickets (escalation_level > 0)
  if (escalatedFilter === "true") {
    filteredTickets = filteredTickets.filter(t => (t.escalation_level || 0) > 0);
  }

  if (user) {
    filteredTickets = filteredTickets.filter(t => {
      const name = (t.creator_name || "").toLowerCase();
      const email = (t.creator_email || "").toLowerCase();
      return name.includes(user.toLowerCase()) || email.includes(user.toLowerCase());
    });
  }

  if (createdFrom) {
    const from = new Date(createdFrom);
    from.setHours(0, 0, 0, 0);
    filteredTickets = filteredTickets.filter(t => t.created_at && t.created_at.getTime() >= from.getTime());
  }

  if (createdTo) {
    const to = new Date(createdTo);
    to.setHours(23, 59, 59, 999);
    filteredTickets = filteredTickets.filter(t => t.created_at && t.created_at.getTime() <= to.getTime());
  }

  if (tat) {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    filteredTickets = filteredTickets.filter(t => {
      const metadata = (t.metadata as TicketMetadata) || {};
      const tatDate = t.resolution_due_at || (metadata?.tatDate && typeof metadata.tatDate === 'string' ? new Date(metadata.tatDate) : null);
      const hasTat = !!tatDate;

      if (tat === "has") return hasTat;
      if (tat === "none") return !hasTat;
      if (tat === "due") return hasTat && tatDate && tatDate.getTime() < now.getTime();
      if (tat === "upcoming") return hasTat && tatDate && tatDate.getTime() >= now.getTime();
      if (tat === "today") {
        return hasTat && tatDate && tatDate.getTime() >= startOfToday.getTime() && tatDate.getTime() <= endOfToday.getTime();
      }
      return true;
    });
  }

  // Apply sorting
  filteredTickets.sort((a, b) => {
    switch (sort) {
      case "newest":
        return (b.created_at?.getTime() || 0) - (a.created_at?.getTime() || 0);
      case "oldest":
        return (a.created_at?.getTime() || 0) - (b.created_at?.getTime() || 0);
      case "status":
        const statusOrder = {
          OPEN: 1, IN_PROGRESS: 2, AWAITING_STUDENT: 3,
          REOPENED: 4, ESCALATED: 5, RESOLVED: 6
        };
        const aStatus = statusOrder[a.status as keyof typeof statusOrder] || 99;
        const bStatus = statusOrder[b.status as keyof typeof statusOrder] || 99;
        if (aStatus !== bStatus) return aStatus - bStatus;
        return (b.created_at?.getTime() || 0) - (a.created_at?.getTime() || 0);
      case "due-date":
        const aDue = a.resolution_due_at?.getTime() || Infinity;
        const bDue = b.resolution_due_at?.getTime() || Infinity;
        if (aDue !== bDue) return aDue - bDue;
        return (b.created_at?.getTime() || 0) - (a.created_at?.getTime() || 0);
      default:
        return (b.created_at?.getTime() || 0) - (a.created_at?.getTime() || 0);
    }
  });

  // Map to TicketCard format (all fields already selected, just add joined fields)
  const allTickets = filteredTickets;

  // Calculate pagination metadata
  const actualCount = allTickets.length;
  const totalPages = Math.ceil(totalCount / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;
  const startIndex = offsetValue + 1;
  const endIndex = Math.min(offsetValue + actualCount, totalCount);

  const pagination = {
    page,
    totalPages,
    hasNextPage,
    hasPrevPage,
    totalCount,
    startIndex,
    endIndex,
    actualCount, // Add actual filtered count
  };

  const stats = {
    total: allTickets.length,
    open: allTickets.filter(t => {
      const normalized = normalizeStatusForComparison(t.status);
      return normalized === "open";
    }).length,
    inProgress: allTickets.filter(t => {
      const normalized = normalizeStatusForComparison(t.status);
      // Include both IN_PROGRESS and ESCALATED status as "in progress"
      return normalized === "in_progress" || normalized === "escalated";
    }).length,
    awaitingStudent: allTickets.filter(t => {
      const normalized = normalizeStatusForComparison(t.status);
      return normalized === "awaiting_student_response";
    }).length,
    resolved: allTickets.filter(t => {
      const normalized = normalizeStatusForComparison(t.status);
      return normalized === "resolved" || normalized === "closed";
    }).length,
    escalated: allTickets.filter(t => (t.escalation_level || 0) > 0).length,
  };

  // Calculate today pending count
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const todayPending = allTickets.filter(t => {
    const normalized = normalizeStatusForComparison(t.status);
    if (!["open", "in_progress", "awaiting_student_response", "reopened"].includes(normalized)) return false;
    const metadata = (t.metadata as TicketMetadata) || {};
    const tatDate = t.resolution_due_at || (metadata?.tatDate && typeof metadata.tatDate === 'string' ? new Date(metadata.tatDate) : null);
    if (!tatDate) return false;
    return tatDate.getTime() >= startOfToday.getTime() && tatDate.getTime() <= endOfToday.getTime();
  }).length;

  // Count unassigned tickets
  const unassignedCount = ticketRows.filter(t => !t.assigned_to).length;

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Super Admin Dashboard
            </h1>
            <p className="text-muted-foreground">
              Manage unassigned tickets, escalations, and system-wide operations
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {unassignedCount > 0 && (
              <Button variant="default" asChild className="bg-amber-500 hover:bg-amber-600">
                <Link href="/superadmin/dashboard?status=open&assigned=unassigned">
                  <Shield className="w-4 h-4 mr-2" />
                  Unassigned Tickets
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-white/20 text-white">
                    {unassignedCount}
                  </span>
                </Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href="/superadmin/dashboard/groups">
                <Users className="w-4 h-4 mr-2" />
                Groups
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/superadmin/dashboard/today">
                <Calendar className="w-4 h-4 mr-2" />
                Today Pending
                {todayPending > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-amber-500 text-white">
                    {todayPending}
                  </span>
                )}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/superadmin/dashboard/escalated">
                <AlertCircle className="w-4 h-4 mr-2" />
                Escalated
                {stats.escalated > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-red-500 text-white">
                    {stats.escalated}
                  </span>
                )}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/superadmin/dashboard/analytics">
                <BarChart3 className="w-4 h-4 mr-2" />
                Analytics
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/superadmin/tickets">
                <FileText className="w-4 h-4 mr-2" />
                All Tickets View
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/superadmin/dashboard/users">
                <Users className="w-4 h-4 mr-2" />
                User & Staff Management
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/superadmin/dashboard/staff">
                <Building2 className="w-4 h-4 mr-2" />
                SPOC Management
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/superadmin/dashboard/forms">
                <FileText className="w-4 h-4 mr-2" />
                Form Management
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/superadmin/dashboard/categories">
                <Settings className="w-4 h-4 mr-2" />
                Category Builder
              </Link>
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <AdminTicketFilters />

          <StatsCards stats={stats} />

          <div className="flex justify-between items-center pt-4">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <FileText className="w-6 h-6" />
              Unassigned Tickets & Escalations
              {unassignedCount > 0 && (
                <span className="ml-2 px-2 py-1 text-xs rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium">
                  {unassignedCount} unassigned
                </span>
              )}
            </h2>
            <p className="text-sm text-muted-foreground">
              {pagination.actualCount} {pagination.actualCount === 1 ? 'ticket' : 'tickets'} on this page
              {pagination.totalPages > 1 && (
                <span className="ml-2">
                  (Page {pagination.page} of {pagination.totalPages})
                </span>
              )}
            </p>
          </div>

          {allTickets.length === 0 ? (
            <Card className="border-2 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-lg font-semibold mb-1">No tickets found</p>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  Unassigned tickets and escalations will appear here. Use the filters above to search for specific tickets.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {allTickets.map((ticket) => (
                  <TicketCard key={ticket.id} ticket={{
                    ...ticket,
                    created_at: ticket.created_at || new Date(),
                    updated_at: ticket.updated_at || new Date(),
                  }} basePath="/superadmin/dashboard" />
                ))}
              </div>

              {/* Pagination Controls */}
              <PaginationControls
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                hasNext={pagination.hasNextPage}
                hasPrev={pagination.hasPrevPage}
                totalCount={pagination.totalCount}
                startIndex={pagination.startIndex}
                endIndex={pagination.endIndex}
                baseUrl="/superadmin/dashboard"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
