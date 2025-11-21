import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { tickets, categories, users, roles, ticket_statuses } from "@/db/schema";
import { eq, sql, inArray } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, Clock, CheckCircle2, AlertCircle, TrendingUp, Users, ArrowLeft, BarChart3, Calendar, Zap, Target, Activity } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getOrCreateUser } from "@/lib/user-sync";
import { getUserRoles } from "@/lib/db-roles";
import { normalizeStatusForComparison } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export default async function SuperAdminAnalyticsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  // Get user from database (already created in layout.tsx)
  const dbUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerk_id, userId))
    .limit(1)
    .then(([user]) => user);

  if (!dbUser) {
    console.error('[Super Admin Analytics] User not found after layout sync');
    redirect('/error?message=user_not_found');
  }

  // Fetch ALL tickets for overall analytics with more details
  let allTickets: any[] = [];
  try {
    allTickets = await db
      .select({
        id: tickets.id,
        status: ticket_statuses.value,
        escalation_level: tickets.escalation_level,
        created_at: tickets.created_at,
        resolved_at: tickets.resolved_at,
        acknowledged_at: tickets.acknowledged_at,
        category_id: tickets.category_id,
        assigned_to: tickets.assigned_to,
        category_name: categories.name,
      })
      .from(tickets)
      .leftJoin(categories, eq(tickets.category_id, categories.id))
      .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
      .orderBy(tickets.created_at);
  } catch (error) {
    console.error('[Super Admin Analytics] Error fetching tickets:', error);
    // Continue with empty array
  }

  // Calculate overall analytics
  const totalTickets = allTickets.length;
  const openTickets = allTickets.filter(t => {
    const normalizedStatus = normalizeStatusForComparison(t.status);
    return normalizedStatus === "open";
  }).length;

  const inProgressTickets = allTickets.filter(t => {
    const normalizedStatus = normalizeStatusForComparison(t.status);
    return normalizedStatus === "in_progress" || normalizedStatus === "awaiting_student_response" || normalizedStatus === "awaiting_student";
  });

  const awaitingStudent = inProgressTickets.filter(t => {
    const normalizedStatus = normalizeStatusForComparison(t.status);
    return normalizedStatus === "awaiting_student_response" || normalizedStatus === "awaiting_student";
  }).length;

  const escalated = inProgressTickets.filter(t => (t.escalation_level || 0) > 0).length;
  const pending = inProgressTickets.length - awaitingStudent - escalated;

  const resolvedTickets = allTickets.filter(t => {
    const normalizedStatus = normalizeStatusForComparison(t.status);
    return normalizedStatus === "resolved";
  });

  // Time-based metrics
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const ticketsToday = allTickets.filter(t =>
    t.created_at && new Date(t.created_at) >= startOfToday
  ).length;

  const ticketsThisWeek = allTickets.filter(t =>
    t.created_at && new Date(t.created_at) >= startOfWeek
  ).length;

  const resolvedToday = resolvedTickets.filter(t =>
    t.resolved_at && new Date(t.resolved_at) >= startOfToday
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
        const hours = (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60);
        return sum + hours;
      }, 0) / resolvedWithTime.length
    )
    : 0;

  // Per Admin Analytics
  let adminStats: any[] = [];
  try {
    adminStats = await db
      .select({
        staff_id: users.id,
        staff_first_name: users.first_name,
        staff_last_name: users.last_name,
        staff_email: users.email,
        total: sql<number>`COUNT(${tickets.id})`.as('total'),
        open: sql<number>`COUNT(CASE WHEN ${ticket_statuses.value} = 'OPEN' THEN 1 END)`.as('open'),
        in_progress: sql<number>`COUNT(CASE WHEN ${ticket_statuses.value} IN ('IN_PROGRESS', 'AWAITING_STUDENT') THEN 1 END)`.as('in_progress'),
        resolved: sql<number>`COUNT(CASE WHEN ${ticket_statuses.value} = 'RESOLVED' THEN 1 END)`.as('resolved'),
      })
      .from(users)
      .innerJoin(roles, eq(users.role_id, roles.id))
      .leftJoin(tickets, eq(tickets.assigned_to, users.id))
      .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
      .where(inArray(roles.name, ['admin', 'super_admin']))
      .groupBy(users.id, users.first_name, users.last_name, users.email)
      .orderBy(sql`COUNT(${tickets.id}) DESC`);
  } catch (error) {
    console.error('[Super Admin Analytics] Error fetching admin stats:', error);
    // Continue with empty array
  }

  // Per Category Analytics
  let categoryStats: any[] = [];
  try {
    categoryStats = await db
      .select({
        category_id: tickets.category_id,
        category_name: categories.name,
        total: sql<number>`COUNT(${tickets.id})`.as('total'),
        open: sql<number>`COUNT(CASE WHEN ${ticket_statuses.value} = 'OPEN' THEN 1 END)`.as('open'),
        in_progress: sql<number>`COUNT(CASE WHEN ${ticket_statuses.value} IN ('IN_PROGRESS', 'AWAITING_STUDENT', 'AWAITING_STUDENT_RESPONSE') THEN 1 END)`.as('in_progress'),
        resolved: sql<number>`COUNT(CASE WHEN ${ticket_statuses.value} = 'RESOLVED' THEN 1 END)`.as('resolved'),
      })
      .from(tickets)
      .leftJoin(categories, eq(tickets.category_id, categories.id))
      .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
      .groupBy(tickets.category_id, categories.name)
      .orderBy(sql`COUNT(${tickets.id}) DESC`);
  } catch (error) {
    console.error('[Super Admin Analytics] Error fetching category stats:', error);
    // Continue with empty array
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" asChild>
          <Link href="/superadmin/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Analytics Dashboard
          </h1>
          <p className="text-muted-foreground">System-wide ticket statistics and performance insights</p>
        </div>
      </div>

      <Tabs defaultValue="overall" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overall">Overall</TabsTrigger>
          <TabsTrigger value="per-admin">Per Admin</TabsTrigger>
          <TabsTrigger value="per-category">Per Category</TabsTrigger>
        </TabsList>

        {/* Overall Analytics */}
        <TabsContent value="overall" className="space-y-6">
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
                  {ticketsToday} created today • {ticketsThisWeek} this week
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
                  Activity Today
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">{ticketsToday}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {resolvedToday} resolved • {ticketsToday - resolvedToday} new
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
                  <p className="text-xs text-muted-foreground mt-1">
                    {inProgressTickets.length > 0
                      ? Math.round((awaitingStudent / inProgressTickets.length) * 100)
                      : 0}% of in-progress
                  </p>
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
                  <p className="text-xs text-muted-foreground mt-1">
                    {inProgressTickets.length > 0
                      ? Math.round((escalated / inProgressTickets.length) * 100)
                      : 0}% of in-progress
                  </p>
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
                  <p className="text-xs text-muted-foreground mt-1">
                    {inProgressTickets.length > 0
                      ? Math.round((pending / inProgressTickets.length) * 100)
                      : 0}% of in-progress
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Status Distribution</CardTitle>
              <CardDescription>Visual breakdown of ticket statuses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Open</span>
                    <span className="text-sm text-muted-foreground">{openTickets} ({openRate}%)</span>
                  </div>
                  <Progress value={openRate} className="h-3" />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">In Progress</span>
                    <span className="text-sm text-muted-foreground">{inProgressTickets.length} ({inProgressRate}%)</span>
                  </div>
                  <Progress value={inProgressRate} className="h-3" />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Resolved</span>
                    <span className="text-sm text-muted-foreground">{resolvedTickets.length} ({resolutionRate}%)</span>
                  </div>
                  <Progress value={resolutionRate} className="h-3" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Per Admin Analytics */}
        <TabsContent value="per-admin" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ticket Statistics by Admin</CardTitle>
              <CardDescription>Performance metrics for each admin</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {adminStats.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No admin statistics available</p>
                ) : (
                  adminStats.map((stat) => {
                    const total = Number(stat.total) || 0;
                    const open = Number(stat.open) || 0;
                    const inProgress = Number(stat.in_progress) || 0;
                    const resolved = Number(stat.resolved) || 0;
                    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
                    const staffName = [stat.staff_first_name, stat.staff_last_name].filter(Boolean).join(' ').trim();

                    return (
                      <Link
                        key={stat.staff_id}
                        href={`/superadmin/dashboard/analytics/admin/${stat.staff_id}`}
                        className="block"
                      >
                        <div className="p-5 border-2 rounded-lg hover:shadow-md transition-all hover:border-primary cursor-pointer">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <p className="font-semibold text-lg">{staffName || stat.staff_email || "Unknown Admin"}</p>
                              <p className="text-sm text-muted-foreground">{stat.staff_email}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-3xl font-bold">{total}</p>
                              <p className="text-xs text-muted-foreground">Total Tickets</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                              <p className="text-xs text-muted-foreground mb-1">Open</p>
                              <p className="text-xl font-semibold">{open}</p>
                              {total > 0 && (
                                <Progress value={(open / total) * 100} className="h-1.5 mt-2" />
                              )}
                            </div>
                            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                              <p className="text-xs text-muted-foreground mb-1">In Progress</p>
                              <p className="text-xl font-semibold">{inProgress}</p>
                              {total > 0 && (
                                <Progress value={(inProgress / total) * 100} className="h-1.5 mt-2" />
                              )}
                            </div>
                            <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                              <p className="text-xs text-muted-foreground mb-1">Resolved</p>
                              <p className="text-xl font-semibold">{resolved}</p>
                              {total > 0 && (
                                <Progress value={(resolved / total) * 100} className="h-1.5 mt-2" />
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-3 border-t">
                            <span className="text-sm text-muted-foreground">Resolution Rate</span>
                            <Badge variant={resolutionRate >= 70 ? "default" : resolutionRate >= 50 ? "secondary" : "destructive"}>
                              {resolutionRate}%
                            </Badge>
                          </div>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Per Category Analytics */}
        <TabsContent value="per-category" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ticket Statistics by Category</CardTitle>
              <CardDescription>Distribution of tickets across categories</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {categoryStats.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No category statistics available</p>
                ) : (
                  categoryStats.map((stat) => {
                    const categoryKey = stat.category_id ?? "uncategorized";
                    const categoryHref = `/superadmin/dashboard/analytics/category/${categoryKey}`;
                    const total = Number(stat.total) || 0;
                    const open = Number(stat.open) || 0;
                    const inProgress = Number(stat.in_progress) || 0;
                    const resolved = Number(stat.resolved) || 0;
                    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

                    return (
                      <Link
                        key={categoryKey}
                        href={categoryHref}
                        className="block"
                      >
                        <div className="p-5 border-2 rounded-lg hover:shadow-md transition-shadow hover:border-primary cursor-pointer">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <p className="font-semibold text-lg">{stat.category_name || "Uncategorized"}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-3xl font-bold">{total}</p>
                              <p className="text-xs text-muted-foreground">Total Tickets</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                              <p className="text-xs text-muted-foreground mb-1">Open</p>
                              <p className="text-xl font-semibold">{open}</p>
                              {total > 0 && (
                                <Progress value={(open / total) * 100} className="h-1.5 mt-2" />
                              )}
                            </div>
                            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                              <p className="text-xs text-muted-foreground mb-1">In Progress</p>
                              <p className="text-xl font-semibold">{inProgress}</p>
                              {total > 0 && (
                                <Progress value={(inProgress / total) * 100} className="h-1.5 mt-2" />
                              )}
                            </div>
                            <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                              <p className="text-xs text-muted-foreground mb-1">Resolved</p>
                              <p className="text-xl font-semibold">{resolved}</p>
                              {total > 0 && (
                                <Progress value={(resolved / total) * 100} className="h-1.5 mt-2" />
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-3 border-t">
                            <span className="text-sm text-muted-foreground">Resolution Rate</span>
                            <Badge variant={resolutionRate >= 70 ? "default" : resolutionRate >= 50 ? "secondary" : "destructive"}>
                              {resolutionRate}%
                            </Badge>
                          </div>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
