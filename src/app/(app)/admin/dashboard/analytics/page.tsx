import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, tickets } from "@/db";
import { eq, or, isNull } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, FileText, Clock, CheckCircle2, ArrowLeft, AlertCircle, BarChart3, Activity, Target, Calendar } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export default async function AdminAnalyticsPage() {
  const { userId, sessionClaims } = await auth();
  if (!userId) redirect("/");

  const role = sessionClaims?.metadata?.role || "student";
  const isSuperAdmin = role === "super_admin";
  if (role === "student") redirect("/student/dashboard");
  if (isSuperAdmin) redirect("/superadmin/dashboard");

  const adminUserId = userId;

  // Get admin's domain/scope assignment
  const { getAdminAssignment, ticketMatchesAdminAssignment } = await import("@/lib/admin-assignment");
  const adminAssignment = await getAdminAssignment(adminUserId);

  // Fetch tickets: assigned to this admin OR unassigned tickets that match admin's domain/scope
  let allTickets = await db
    .select()
    .from(tickets)
    .where(
      or(
        eq(tickets.assignedTo, adminUserId),
        isNull(tickets.assignedTo)
      )
    );

  // Filter unassigned tickets to only show those matching admin's domain/scope
  if (adminAssignment.domain) {
    allTickets = allTickets.filter(t => {
      // If assigned to this admin, always show
      if (t.assignedTo === adminUserId) {
        return true;
      }
      // If unassigned, only show if matches admin's domain/scope
      if (!t.assignedTo) {
        return ticketMatchesAdminAssignment(
          { category: t.category, location: t.location },
          adminAssignment
        );
      }
      return false;
    });
  }

  const now = new Date();
  const totalTickets = allTickets.length;

  // Calculate metrics
  const openTickets = allTickets.filter(
    (t) => t.status && ["open", "in_progress", "awaiting_student_response", "reopened"].includes(t.status)
  ).length;

  const inProgressTickets = allTickets.filter((t) => t.status === "in_progress").length;
  const awaitingResponseTickets = allTickets.filter((t) => t.status === "awaiting_student_response").length;
  const acknowledgedTickets = allTickets.filter((t) => t.acknowledgedAt).length;
  const resolvedTickets = allTickets.filter((t) =>
    ["closed", "resolved"].includes(t.status || "")
  ).length;
  const escalatedTickets = allTickets.filter((t) => (Number(t.escalationCount) || 0) > 0).length;

  // Calculate percentages
  const openPercentage = totalTickets > 0 ? (openTickets / totalTickets) * 100 : 0;
  const acknowledgedPercentage = totalTickets > 0 ? (acknowledgedTickets / totalTickets) * 100 : 0;
  const resolvedPercentage = totalTickets > 0 ? (resolvedTickets / totalTickets) * 100 : 0;
  const escalatedPercentage = totalTickets > 0 ? (escalatedTickets / totalTickets) * 100 : 0;

  // Category breakdown
  const hostelTickets = allTickets.filter((t) => t.category === "Hostel").length;
  const collegeTickets = allTickets.filter((t) => t.category === "College").length;

  // Status breakdown with colors
  const statusBreakdown = [
    { label: "Open", value: allTickets.filter((t) => t.status === "open").length, color: "bg-blue-500" },
    { label: "In Progress", value: inProgressTickets, color: "bg-amber-500" },
    { label: "Awaiting Response", value: awaitingResponseTickets, color: "bg-indigo-500" },
    { label: "Resolved", value: allTickets.filter((t) => t.status === "resolved").length, color: "bg-emerald-500" },
    { label: "Closed", value: allTickets.filter((t) => t.status === "closed").length, color: "bg-gray-500" },
  ];

  // Calculate TAT on acknowledgement
  const acknowledgedWithTimestamps = allTickets.filter(
    (t) => t.acknowledgedAt && t.createdAt
  );

  let avgAcknowledgementTat = 0;
  if (acknowledgedWithTimestamps.length > 0) {
    const totalHours = acknowledgedWithTimestamps.reduce((sum, t) => {
      const created = new Date(t.createdAt!);
      const acknowledged = new Date(t.acknowledgedAt!);
      const hours = (acknowledged.getTime() - created.getTime()) / (1000 * 60 * 60);
      return sum + hours;
    }, 0);
    avgAcknowledgementTat = totalHours / acknowledgedWithTimestamps.length;
  }

  // Format TAT
  const formatTAT = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)} min`;
    } else if (hours < 24) {
      return `${hours.toFixed(1)} hrs`;
    } else {
      return `${(hours / 24).toFixed(1)} days`;
    }
  };

  // Calculate resolution time
  const resolvedWithTimestamps = allTickets.filter(
    (t) => t.status && ["closed", "resolved"].includes(t.status) && t.createdAt && t.updatedAt
  );

  let avgResolutionTime = 0;
  if (resolvedWithTimestamps.length > 0) {
    const totalHours = resolvedWithTimestamps.reduce((sum, t) => {
      const created = new Date(t.createdAt!);
      const updated = new Date(t.updatedAt!);
      const hours = (updated.getTime() - created.getTime()) / (1000 * 60 * 60);
      return sum + hours;
    }, 0);
    avgResolutionTime = totalHours / resolvedWithTimestamps.length;
  }

  // Calculate response time
  const ticketsWithResponse = allTickets.filter((t) => {
    if (!t.acknowledgedAt && !t.details) return false;
    try {
      const d = t.details ? JSON.parse(String(t.details)) : {};
      const hasComments = Array.isArray(d.comments) && d.comments.length > 0;
      return t.acknowledgedAt || hasComments;
    } catch {
      return !!t.acknowledgedAt;
    }
  });

  let avgResponseTime = 0;
  if (ticketsWithResponse.length > 0) {
    const totalHours = ticketsWithResponse.reduce((sum, t) => {
      const created = new Date(t.createdAt!);
      let responseTime = 0;
      if (t.acknowledgedAt) {
        const acknowledged = new Date(t.acknowledgedAt);
        responseTime = (acknowledged.getTime() - created.getTime()) / (1000 * 60 * 60);
      } else {
        try {
          const d = t.details ? JSON.parse(String(t.details)) : {};
          if (Array.isArray(d.comments) && d.comments.length > 0) {
            const firstComment = d.comments[0];
            const commentDate = new Date(firstComment.createdAt);
            responseTime = (commentDate.getTime() - created.getTime()) / (1000 * 60 * 60);
          }
        } catch {}
      }
      return sum + responseTime;
    }, 0);
    avgResponseTime = totalHours / ticketsWithResponse.length;
  }

  // Time-based metrics
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const ticketsLast7Days = allTickets.filter((t) => {
    const created = new Date(t.createdAt!);
    return created.getTime() >= sevenDaysAgo.getTime();
  }).length;

  const ticketsLast30Days = allTickets.filter((t) => {
    const created = new Date(t.createdAt!);
    return created.getTime() >= thirtyDaysAgo.getTime();
  }).length;

  const resolvedLast7Days = allTickets.filter((t) => {
    if (!["closed", "resolved"].includes(t.status || "")) return false;
    const updated = t.updatedAt ? new Date(t.updatedAt) : null;
    return updated && updated.getTime() >= sevenDaysAgo.getTime();
  }).length;

  const resolvedLast30Days = allTickets.filter((t) => {
    if (!["closed", "resolved"].includes(t.status || "")) return false;
    const updated = t.updatedAt ? new Date(t.updatedAt) : null;
    return updated && updated.getTime() >= thirtyDaysAgo.getTime();
  }).length;

  // Calculate average tickets per day
  const avgTicketsPerDay7 = ticketsLast7Days / 7;
  const avgTicketsPerDay30 = ticketsLast30Days / 30;
  const resolutionRate7Days = ticketsLast7Days > 0 ? (resolvedLast7Days / ticketsLast7Days) * 100 : 0;
  const resolutionRate30Days = ticketsLast30Days > 0 ? (resolvedLast30Days / ticketsLast30Days) * 100 : 0;

  // Helper function to create enhanced bar chart
  const EnhancedBarChart = ({ label, value, max, color, showPercentage = true }: { 
    label: string; 
    value: number; 
    max: number; 
    color: string;
    showPercentage?: boolean;
  }) => {
    const percentage = max > 0 ? (value / max) * 100 : 0;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{label}</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{value}</span>
            {showPercentage && (
              <Badge variant="secondary" className="text-xs">
                {percentage.toFixed(0)}%
              </Badge>
            )}
          </div>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div 
            className={`h-full ${color} transition-all duration-500 rounded-full`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">Analytics</h1>
          <p className="text-muted-foreground text-sm">
            Performance metrics and insights
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
        </Button>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Total Tickets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalTickets}</div>
            <div className="text-xs text-muted-foreground mt-1">All assigned tickets</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Open
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{openTickets}</div>
            <div className="text-xs text-muted-foreground mt-1">{openPercentage.toFixed(1)}% of total</div>
            <Progress value={openPercentage} className="h-1.5 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Acknowledged
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{acknowledgedTickets}</div>
            <div className="text-xs text-muted-foreground mt-1">{acknowledgedPercentage.toFixed(1)}% of total</div>
            <Progress value={acknowledgedPercentage} className="h-1.5 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Resolved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{resolvedTickets}</div>
            <div className="text-xs text-muted-foreground mt-1">{resolvedPercentage.toFixed(1)}% of total</div>
            <Progress value={resolvedPercentage} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status Breakdown Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {statusBreakdown.map((status) => (
              <EnhancedBarChart
                key={status.label}
                label={status.label}
                value={status.value}
                max={totalTickets}
                color={status.color}
              />
            ))}
          </CardContent>
        </Card>

        {/* Category Breakdown Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Category Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <EnhancedBarChart
              label="Hostel"
              value={hostelTickets}
              max={totalTickets}
              color="bg-blue-500"
            />
            <EnhancedBarChart
              label="College"
              value={collegeTickets}
              max={totalTickets}
              color="bg-purple-500"
            />
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              TAT on Acknowledgement
            </CardTitle>
          </CardHeader>
          <CardContent>
            {acknowledgedWithTimestamps.length > 0 ? (
              <div>
                <div className="text-3xl font-bold mb-2">{formatTAT(avgAcknowledgementTat)}</div>
                <div className="text-xs text-muted-foreground mb-3">Average time to acknowledgement</div>
                <div className="flex items-center justify-between text-xs pt-2 border-t">
                  <span className="text-muted-foreground">Sample size</span>
                  <Badge variant="secondary">{acknowledgedWithTimestamps.length}</Badge>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground py-4">No data available</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Avg Response Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ticketsWithResponse.length > 0 ? (
              <div>
                <div className="text-3xl font-bold mb-2 text-emerald-600 dark:text-emerald-400">{formatTAT(avgResponseTime)}</div>
                <div className="text-xs text-muted-foreground mb-3">Time to first response</div>
                <div className="flex items-center justify-between text-xs pt-2 border-t">
                  <span className="text-muted-foreground">Sample size</span>
                  <Badge variant="secondary">{ticketsWithResponse.length}</Badge>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground py-4">No data available</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Avg Resolution Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {resolvedWithTimestamps.length > 0 ? (
              <div>
                <div className="text-3xl font-bold mb-2 text-blue-600 dark:text-blue-400">{formatTAT(avgResolutionTime)}</div>
                <div className="text-xs text-muted-foreground mb-3">Time to resolution</div>
                <div className="flex items-center justify-between text-xs pt-2 border-t">
                  <span className="text-muted-foreground">Sample size</span>
                  <Badge variant="secondary">{resolvedWithTimestamps.length}</Badge>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground py-4">No data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Time Period Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Last 7 Days
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Created</div>
                <div className="text-2xl font-bold">{ticketsLast7Days}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  ~{avgTicketsPerDay7.toFixed(1)}/day
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Resolved</div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{resolvedLast7Days}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {resolutionRate7Days.toFixed(1)}% rate
                </div>
              </div>
            </div>
            <Progress 
              value={resolutionRate7Days} 
              className="h-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Last 30 Days
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Created</div>
                <div className="text-2xl font-bold">{ticketsLast30Days}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  ~{avgTicketsPerDay30.toFixed(1)}/day
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Resolved</div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{resolvedLast30Days}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {resolutionRate30Days.toFixed(1)}% rate
                </div>
              </div>
            </div>
            <Progress 
              value={resolutionRate30Days} 
              className="h-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Performance Rates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Key Performance Indicators
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Resolution Rate
              </span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {resolvedPercentage.toFixed(1)}%
              </span>
            </div>
            <Progress value={resolvedPercentage} className="h-2.5" />
            <div className="text-xs text-muted-foreground mt-1">
              {resolvedTickets} of {totalTickets} tickets resolved
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                Acknowledgement Rate
              </span>
              <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                {acknowledgedPercentage.toFixed(1)}%
              </span>
            </div>
            <Progress value={acknowledgedPercentage} className="h-2.5" />
            <div className="text-xs text-muted-foreground mt-1">
              {acknowledgedTickets} of {totalTickets} tickets acknowledged
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                Escalation Rate
              </span>
              <span className="text-sm font-bold text-red-600 dark:text-red-400">
                {escalatedPercentage.toFixed(1)}%
              </span>
            </div>
            <Progress value={escalatedPercentage} className="h-2.5" />
            <div className="text-xs text-muted-foreground mt-1">
              {escalatedTickets} of {totalTickets} tickets escalated
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
