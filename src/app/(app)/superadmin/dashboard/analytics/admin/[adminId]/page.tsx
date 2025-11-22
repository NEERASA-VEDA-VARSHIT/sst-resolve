import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { tickets, categories, users, ticket_statuses, domains, scopes } from "@/db/schema";
import { eq, desc, inArray, gte, and } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, Clock, CheckCircle2, AlertCircle, TrendingUp, Users, ArrowLeft, Zap, Target, Activity, Mail, Phone } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getOrCreateUser } from "@/lib/user-sync";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { normalizeStatusForComparison } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TicketCard } from "@/components/layout/TicketCard";

export default async function AdminDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ adminId: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  // Ensure user exists in database
  await getOrCreateUser(userId);

  // Get role from database (single source of truth)
  const role = await getUserRoleFromDB(userId);

  if (role !== 'super_admin') {
    redirect('/student/dashboard');
  }

  const { adminId } = await params;
  const { period: periodParam } = await searchParams;
  const period = periodParam || "all";

  // adminId is UUID string

  // Fetch user details with domain/scope info
  const [userRecord] = await db
    .select({
      id: users.id,
      first_name: users.first_name,
      last_name: users.last_name,
      email: users.email,
      phone: users.phone,
      role_id: users.role_id,
      domain_name: domains.name,
      scope_name: scopes.name,
    })
    .from(users)
    .leftJoin(domains, eq(users.primary_domain_id, domains.id))
    .leftJoin(scopes, eq(users.primary_scope_id, scopes.id))
    .where(eq(users.id, adminId))
    .limit(1);

  if (!userRecord) {
    notFound();
  }

  const adminStaff = {
    id: userRecord.id,
    user_id: userRecord.id,
    domain: userRecord.domain_name,
    scope: userRecord.scope_name,
    role: "Admin", // Simplified, could fetch role name from roles table
    staff_name: [userRecord.first_name, userRecord.last_name].filter(Boolean).join(" "),
    staff_email: userRecord.email,
    staff_phone: userRecord.phone,
  };

  // Time filter logic
  let timeFilter = undefined;
  const now = new Date();
  if (period === "7d") {
    const date = new Date(now);
    date.setDate(date.getDate() - 7);
    timeFilter = gte(tickets.created_at, date);
  } else if (period === "30d") {
    const date = new Date(now);
    date.setDate(date.getDate() - 30);
    timeFilter = gte(tickets.created_at, date);
  }

  // Fetch all tickets assigned to this admin
  let ticketRows: Array<{
    id: number;
    title: string | null;
    description: string | null;
    location: string | null;
    status_id: number;
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
    status_value: string | null;
  }> = [];

  try {
    const rawTicketRows = await db
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
        status_value: ticket_statuses.value,
      })
      .from(tickets)
      .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
      .where(and(eq(tickets.assigned_to, adminId), timeFilter))
      .orderBy(desc(tickets.created_at))
      .limit(1000);

    // Use rawTicketRows directly - they already have all the fields we need
    ticketRows = rawTicketRows;
  } catch (error) {
    console.error("[Super Admin Analytics Admin] Error fetching tickets:", error);
    // Continue with empty array
    ticketRows = [];
  }

  // Fetch category and creator info separately
  const categoryIds = [...new Set(ticketRows.map(t => t.category_id).filter((id): id is number => id !== null && id !== undefined))];
  const userIds = [...new Set(ticketRows.map(t => t.created_by).filter((id): id is string => id !== null && id !== undefined))];

  const categoryMap = new Map<number, { name: string; parentId: number | null }>();
  if (categoryIds.length > 0) {
    try {
      const categoryData = await db
        .select({
          id: categories.id,
          name: categories.name,
          parent_category_id: categories.parent_category_id,
        })
        .from(categories)
        .where(inArray(categories.id, categoryIds));
      categoryData.forEach(cat => categoryMap.set(cat.id, { name: cat.name || "", parentId: cat.parent_category_id }));
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  }

  const userMap = new Map<string, { name: string | null; email: string | null }>();
  if (userIds.length > 0) {
    try {
      const userData = await db
        .select({
          id: users.id,
          first_name: users.first_name,
          last_name: users.last_name,
          email: users.email,
        })
        .from(users)
        .where(inArray(users.id, userIds));
      userData.forEach(u => userMap.set(u.id, { name: [u.first_name, u.last_name].filter(Boolean).join(" "), email: u.email }));
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  }

  // Combine data - add all required Ticket fields and additional fields for TicketCard
  const allTickets = ticketRows.map(t => {
    const catInfo = t.category_id ? categoryMap.get(t.category_id) : null;
    return {
      ...t,
      // Additional fields for TicketCard
      status: t.status_value || null,
      category_name: catInfo?.name || null,
      creator_name: t.created_by ? userMap.get(t.created_by)?.name || null : null,
      creator_email: t.created_by ? userMap.get(t.created_by)?.email || null : null,
    };
  });

  // Calculate analytics
  const totalTickets = allTickets.length;

  // Open tickets (status = OPEN)
  const openTickets = allTickets.filter(t => {
    const normalizedStatus = normalizeStatusForComparison(t.status);
    return normalizedStatus === "open";
  }).length;

  // In Progress tickets (status = IN_PROGRESS or AWAITING_STUDENT)
  const inProgressTickets = allTickets.filter(t => {
    const statusStr = typeof t.status === 'string' ? t.status : (t.status && typeof t.status === 'object' && t.status !== null && 'value' in t.status ? (t.status as { value?: string }).value : null) || null;
    const normalizedStatus = normalizeStatusForComparison(statusStr);
    return normalizedStatus === "in_progress" || normalizedStatus === "awaiting_student_response" || normalizedStatus === "awaiting_student";
  });

  // Breakdown of in-progress tickets
  const awaitingStudent = inProgressTickets.filter(t => {
    const normalizedStatus = normalizeStatusForComparison(t.status);
    return normalizedStatus === "awaiting_student_response" || normalizedStatus === "awaiting_student";
  }).length;

  const escalated = inProgressTickets.filter(t => (t.escalation_level || 0) > 0).length;
  const pending = inProgressTickets.length - awaitingStudent - escalated;

  // Resolved tickets (status = RESOLVED or CLOSED)
  const resolvedTickets = allTickets.filter(t => {
    const normalizedStatus = normalizeStatusForComparison(t.status);
    return normalizedStatus === "resolved" || normalizedStatus === "closed";
  });

  // Time-based metrics
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now);
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const ticketsToday = allTickets.filter(t =>
    t.created_at && t.created_at >= startOfToday
  ).length;

  const ticketsThisWeek = allTickets.filter(t =>
    t.created_at && t.created_at >= startOfWeek
  ).length;

  const ticketsThisMonth = allTickets.filter(t =>
    t.created_at && t.created_at >= startOfMonth
  ).length;

  const resolvedToday = resolvedTickets.filter(t =>
    t.resolved_at && t.resolved_at >= startOfToday
  ).length;

  // const resolvedThisWeek = resolvedTickets.filter(t =>
  //   t.resolved_at && t.resolved_at >= startOfWeek
  // ).length;

  const resolvedThisMonth = resolvedTickets.filter(t =>
    t.resolved_at && t.resolved_at >= startOfMonth
  ).length;

  // Calculate percentages
  const resolutionRate = totalTickets > 0 ? Math.round((resolvedTickets.length / totalTickets) * 100) : 0;
  const openRate = totalTickets > 0 ? Math.round((openTickets / totalTickets) * 100) : 0;
  const inProgressRate = totalTickets > 0 ? Math.round((inProgressTickets.length / totalTickets) * 100) : 0;

  // Calculate average resolution time
  const resolvedWithTime = resolvedTickets.filter(t => t.created_at && t.resolved_at);
  const avgResolutionHours = resolvedWithTime.length > 0
    ? Math.round(
      resolvedWithTime.reduce((sum, t) => {
        const hours = (t.resolved_at!.getTime() - t.created_at!.getTime()) / (1000 * 60 * 60);
        return sum + hours;
      }, 0) / resolvedWithTime.length
    )
    : 0;

  // Category breakdown
  const categoryBreakdown: Record<string, { total: number; open: number; inProgress: number; resolved: number }> = {};
  allTickets.forEach(t => {
    // Use metadata.subcategory if available, otherwise category_name
    const metadata = t.metadata && typeof t.metadata === 'object' && t.metadata !== null ? t.metadata as Record<string, unknown> : null;
    const subcategory = metadata && typeof metadata.subcategory === 'string' ? metadata.subcategory : undefined;
    const catName = (subcategory || t.category_name || "Uncategorized") as string;

    if (!categoryBreakdown[catName]) {
      categoryBreakdown[catName] = { total: 0, open: 0, inProgress: 0, resolved: 0 };
    }
    categoryBreakdown[catName].total++;
    const normalizedStatus = normalizeStatusForComparison(t.status);
    if (normalizedStatus === "open") {
      categoryBreakdown[catName].open++;
    } else if (normalizedStatus === "in_progress" || normalizedStatus === "awaiting_student_response" || normalizedStatus === "awaiting_student") {
      categoryBreakdown[catName].inProgress++;
    } else if (normalizedStatus === "resolved" || normalizedStatus === "closed") {
      categoryBreakdown[catName].resolved++;
    }
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild>
            <Link href="/superadmin/dashboard/analytics">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Analytics
            </Link>
          </Button>
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Admin Performance Dashboard
            </h1>
            <p className="text-muted-foreground">Detailed analytics for {adminStaff.staff_name || adminStaff.staff_email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={period === '7d' ? 'default' : 'outline'} size="sm" asChild>
            <Link href="?period=7d">7 Days</Link>
          </Button>
          <Button variant={period === '30d' ? 'default' : 'outline'} size="sm" asChild>
            <Link href="?period=30d">30 Days</Link>
          </Button>
          <Button variant={period === 'all' ? 'default' : 'outline'} size="sm" asChild>
            <Link href="?period=all">All Time</Link>
          </Button>
        </div>
      </div>

      {/* Admin Info Card */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle>Admin Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Name</p>
              <p className="font-semibold text-lg">{adminStaff.staff_name || "Not provided"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                <Mail className="h-3 w-3" />
                Email
              </p>
              <p className="font-semibold">{adminStaff.staff_email || "Not provided"}</p>
            </div>
            {adminStaff.staff_phone && (
              <div>
                <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  Phone
                </p>
                <p className="font-semibold">{adminStaff.staff_phone}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground mb-1">Role</p>
              <Badge variant="secondary" className="text-sm">
                {adminStaff.role || "Admin"}
              </Badge>
            </div>
            {adminStaff.domain && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Domain</p>
                <Badge variant="outline">{adminStaff.domain}</Badge>
              </div>
            )}
            {adminStaff.scope && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Scope</p>
                <Badge variant="outline">{adminStaff.scope}</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalTickets}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {ticketsToday} today • {ticketsThisWeek} this week • {ticketsThisMonth} this month
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 border-amber-200 dark:border-amber-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
            <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{openTickets}</div>
            <div className="mt-2">
              <Progress value={openRate} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">{openRate}% of total</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{inProgressTickets.length}</div>
            <div className="mt-2">
              <Progress value={inProgressRate} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">{inProgressRate}% of total</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{resolvedTickets.length}</div>
            <div className="mt-2">
              <Progress value={resolutionRate} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {resolutionRate}% resolution rate • {resolvedToday} today
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Resolution Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{resolutionRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {resolvedTickets.length} of {totalTickets} tickets resolved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Avg Resolution Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">
              {avgResolutionHours > 24
                ? `${Math.round(avgResolutionHours / 24)}d`
                : `${avgResolutionHours}h`
              }
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Based on {resolvedWithTime.length} resolved tickets
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{ticketsThisMonth}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {resolvedThisMonth} resolved • {ticketsThisMonth - resolvedThisMonth} active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* In Progress Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>In Progress Breakdown</CardTitle>
          <CardDescription>Detailed breakdown of tickets currently in progress</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-5 border-2 border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50/50 dark:bg-blue-950/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Awaiting Student</p>
                    <p className="text-xs text-muted-foreground">Waiting for response</p>
                  </div>
                </div>
              </div>
              <div className="text-3xl font-bold mb-2">{awaitingStudent}</div>
              <Progress
                value={inProgressTickets.length > 0 ? (awaitingStudent / inProgressTickets.length) * 100 : 0}
                className="h-2"
              />
            </div>

            <div className="p-5 border-2 border-red-200 dark:border-red-800 rounded-lg bg-red-50/50 dark:bg-red-950/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Escalated</p>
                    <p className="text-xs text-muted-foreground">Higher level support</p>
                  </div>
                </div>
              </div>
              <div className="text-3xl font-bold mb-2">{escalated}</div>
              <Progress
                value={inProgressTickets.length > 0 ? (escalated / inProgressTickets.length) * 100 : 0}
                className="h-2"
              />
            </div>

            <div className="p-5 border-2 border-amber-200 dark:border-amber-800 rounded-lg bg-amber-50/50 dark:bg-amber-950/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Pending</p>
                    <p className="text-xs text-muted-foreground">Awaiting action</p>
                  </div>
                </div>
              </div>
              <div className="text-3xl font-bold mb-2">{pending}</div>
              <Progress
                value={inProgressTickets.length > 0 ? (pending / inProgressTickets.length) * 100 : 0}
                className="h-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      {Object.keys(categoryBreakdown).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
            <CardDescription>Ticket distribution by category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(categoryBreakdown).map(([category, stats]) => {
                const catResolutionRate = stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;
                return (
                  <div key={category} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-semibold">{category}</p>
                      <Badge variant="outline">{stats.total} tickets</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mb-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Open</p>
                        <p className="text-lg font-semibold">{stats.open}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">In Progress</p>
                        <p className="text-lg font-semibold">{stats.inProgress}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Resolved</p>
                        <p className="text-lg font-semibold">{stats.resolved}</p>
                      </div>
                    </div>
                    <Progress value={catResolutionRate} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">{catResolutionRate}% resolution rate</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Tickets */}
      <Card>
        <CardHeader>
          <CardTitle>Assigned Tickets</CardTitle>
          <CardDescription>All tickets assigned to this admin</CardDescription>
        </CardHeader>
        <CardContent>
          {allTickets.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No tickets assigned to this admin</p>
          ) : (
            <div className="space-y-4">
              {allTickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  basePath="/superadmin/dashboard"
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
