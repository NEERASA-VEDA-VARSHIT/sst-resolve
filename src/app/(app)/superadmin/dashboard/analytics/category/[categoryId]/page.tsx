import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { tickets, categories, ticket_statuses, users } from "@/db/schema";
import { eq, desc, isNull, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getOrCreateUser } from "@/lib/user-sync";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { normalizeStatusForComparison } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  AlertCircle,
  Clock,
  CheckCircle2,
  Users,
  Layers,
  TrendingUp,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TicketCard } from "@/components/layout/TicketCard";

const assignedUsers = alias(users, "category_assigned_users");

export default async function CategoryAnalyticsDetailPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  await getOrCreateUser(userId);
  const role = await getUserRoleFromDB(userId);

  if (role !== "super_admin") {
    redirect("/student/dashboard");
  }

  const { categoryId } = await params;
  const isUncategorized = categoryId === "uncategorized";

  let categoryCondition = isNull(tickets.category_id);
  let categoryName = "Uncategorized";
  let parentCategoryName: string | null = null;

  if (isUncategorized) {
    categoryCondition = isNull(tickets.category_id);
  } else {
    const parsedId = Number(categoryId);
    if (Number.isNaN(parsedId)) {
      notFound();
    }
    categoryCondition = eq(tickets.category_id, parsedId);
    const [categoryRecord] = await db
      .select({
        id: categories.id,
        name: categories.name,
        parentId: categories.parent_category_id,
      })
      .from(categories)
      .where(eq(categories.id, parsedId))
      .limit(1);

    if (!categoryRecord) {
      notFound();
    }

    categoryCondition = eq(tickets.category_id, parsedId);
    categoryName = categoryRecord.name || "Unnamed Category";

    if (categoryRecord.parentId) {
      const [parentRecord] = await db
        .select({
          name: categories.name,
        })
        .from(categories)
        .where(eq(categories.id, categoryRecord.parentId))
        .limit(1);
      parentCategoryName = parentRecord?.name ?? null;
    }
  }

  const rawTickets = await db
    .select({
      id: tickets.id,
      status_value: ticket_statuses.value,
      description: tickets.description,
      location: tickets.location,
      created_by: tickets.created_by,
      category_id: tickets.category_id,
      category_name: categories.name,
      metadata: tickets.metadata,
      created_at: tickets.created_at,
      updated_at: tickets.updated_at,
      resolved_at: tickets.resolved_at,
      due_at: tickets.resolution_due_at,
      escalation_level: tickets.escalation_level,
      rating: tickets.rating,
      assigned_to: tickets.assigned_to,
      assigned_first_name: assignedUsers.first_name,
      assigned_last_name: assignedUsers.last_name,
      assigned_email: assignedUsers.email,
    })
    .from(tickets)
    .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
    .leftJoin(categories, eq(tickets.category_id, categories.id))
    .leftJoin(assignedUsers, eq(tickets.assigned_to, assignedUsers.id))
    .where(categoryCondition)
    .orderBy(desc(tickets.created_at));

  const creatorIds = Array.from(
    new Set(
      rawTickets
        .map((ticket) => ticket.created_by)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );

  const creatorMap = new Map<
    string,
    {
      name: string | null;
      email: string | null;
    }
  >();

  if (creatorIds.length > 0) {
    const creators = await db
      .select({
        id: users.id,
        first_name: users.first_name,
        last_name: users.last_name,
        email: users.email,
      })
      .from(users)
      .where(inArray(users.id, creatorIds));

    creators.forEach((creator) => {
      creatorMap.set(creator.id, {
        name: [creator.first_name, creator.last_name].filter(Boolean).join(" ") || null,
        email: creator.email,
      });
    });
  }

  const allTickets = rawTickets.map((ticket) => {
    const assignedName = [ticket.assigned_first_name, ticket.assigned_last_name]
      .filter(Boolean)
      .join(" ")
      .trim();

    const creator = ticket.created_by ? creatorMap.get(ticket.created_by) : undefined;

    // Ensure category label fallback for uncategorized rows
    const derivedCategoryName = ticket.category_name || categoryName;

    return {
      id: ticket.id,
      status: ticket.status_value,
      description: ticket.description,
      location: ticket.location,
      created_by: ticket.created_by,
      category_id: ticket.category_id,
      category_name: derivedCategoryName,
      metadata: ticket.metadata,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      resolved_at: ticket.resolved_at,
      due_at: ticket.due_at,
      escalation_level: ticket.escalation_level,
      rating: ticket.rating,
      assigned_to: ticket.assigned_to,
      assigned_name: assignedName || (ticket.assigned_email ?? "Unassigned"),
      assigned_email: ticket.assigned_email,
      creator_name: creator?.name ?? null,
      creator_email: creator?.email ?? null,
    };
  });

  const totalTickets = allTickets.length;
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const openTickets = allTickets.filter((ticket) => normalizeStatusForComparison(ticket.status) === "open");
  const inProgressTickets = allTickets.filter((ticket) => {
    const normalized = normalizeStatusForComparison(ticket.status);
    return (
      normalized === "in_progress" ||
      normalized === "awaiting_student_response" ||
      normalized === "awaiting_student" ||
      normalized === "reopened"
    );
  });
  const resolvedTickets = allTickets.filter((ticket) => {
    const normalized = normalizeStatusForComparison(ticket.status);
    return normalized === "resolved" || normalized === "closed";
  });

  const awaitingStudent = inProgressTickets.filter((ticket) => {
    const normalized = normalizeStatusForComparison(ticket.status);
    return normalized === "awaiting_student_response" || normalized === "awaiting_student";
  }).length;

  const escalated = inProgressTickets.filter((ticket) => (ticket.escalation_level || 0) > 0).length;
  const pending = inProgressTickets.length - awaitingStudent - escalated;

  const ticketsToday = allTickets.filter(
    (ticket) => ticket.created_at && ticket.created_at >= startOfToday,
  ).length;
  const ticketsThisWeek = allTickets.filter(
    (ticket) => ticket.created_at && ticket.created_at >= startOfWeek,
  ).length;
  const resolvedToday = resolvedTickets.filter(
    (ticket) => ticket.resolved_at && ticket.resolved_at >= startOfToday,
  ).length;
  const resolvedThisWeek = resolvedTickets.filter(
    (ticket) => ticket.resolved_at && ticket.resolved_at >= startOfWeek,
  ).length;

  const resolutionRate = totalTickets > 0 ? Math.round((resolvedTickets.length / totalTickets) * 100) : 0;
  const openRate = totalTickets > 0 ? Math.round((openTickets.length / totalTickets) * 100) : 0;
  const inProgressRate = totalTickets > 0 ? Math.round((inProgressTickets.length / totalTickets) * 100) : 0;

  const resolvedWithTime = resolvedTickets.filter((ticket) => ticket.created_at && ticket.resolved_at);
  const avgResolutionHours =
    resolvedWithTime.length > 0
      ? Math.round(
          resolvedWithTime.reduce((sum, ticket) => {
            const hours =
              ((ticket.resolved_at as Date).getTime() - (ticket.created_at as Date).getTime()) / (1000 * 60 * 60);
            return sum + hours;
          }, 0) / resolvedWithTime.length,
        )
      : 0;

  const unassignedTickets = allTickets.filter((ticket) => !ticket.assigned_to).length;

  const adminBreakdownMap = new Map<
    string,
    {
      id: string | null;
      name: string;
      email: string | null;
      total: number;
      resolved: number;
    }
  >();

  allTickets.forEach((ticket) => {
    const key = ticket.assigned_to ?? "unassigned";
    if (!adminBreakdownMap.has(key)) {
      adminBreakdownMap.set(key, {
        id: ticket.assigned_to ?? null,
        name: ticket.assigned_name || (ticket.assigned_to ? ticket.assigned_to : "Unassigned"),
        email: ticket.assigned_email ?? null,
        total: 0,
        resolved: 0,
      });
    }

    const entry = adminBreakdownMap.get(key)!;
    entry.total += 1;
    if (normalizeStatusForComparison(ticket.status) === "resolved" || normalizeStatusForComparison(ticket.status) === "closed") {
      entry.resolved += 1;
    }
  });

  const adminBreakdown = Array.from(adminBreakdownMap.values()).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild>
            <Link href="/superadmin/dashboard/analytics">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Analytics
            </Link>
          </Button>
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-1 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              {categoryName}
            </h1>
            <p className="text-muted-foreground">
              Category performance overview{parentCategoryName ? ` • Parent: ${parentCategoryName}` : ""}
            </p>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {totalTickets} tickets • {ticketsThisWeek} this week
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-2">
          <CardHeader className="flex items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalTickets}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {ticketsToday} today • {ticketsThisWeek} this week
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 border-amber-200 dark:border-amber-800">
          <CardHeader className="flex items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
            <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{openTickets.length}</div>
            <div className="mt-2">
              <Progress value={openRate} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">{openRate}% of total</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex items-center justify-between space-y-0 pb-2">
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
          <CardHeader className="flex items-center justify-between space-y-0 pb-2">
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

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
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
              <Clock className="h-4 w-4" />
              Avg Resolution Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">
              {avgResolutionHours > 24 ? `${Math.round(avgResolutionHours / 24)}d` : `${avgResolutionHours}h`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Based on {resolvedWithTime.length} resolved tickets
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Assignment Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{unassignedTickets}</p>
            <p className="text-xs text-muted-foreground mt-1">Unassigned tickets</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>In Progress Breakdown</CardTitle>
          <CardDescription>Awaiting student, escalations, and pending tickets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-5 border-2 border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50/50 dark:bg-blue-950/20">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Awaiting Student</p>
                  <p className="text-xs text-muted-foreground">Waiting on student response</p>
                </div>
              </div>
              <div className="text-3xl font-bold mb-2">{awaitingStudent}</div>
              <Progress
                value={inProgressTickets.length > 0 ? (awaitingStudent / inProgressTickets.length) * 100 : 0}
                className="h-2"
              />
            </div>

            <div className="p-5 border-2 border-red-200 dark:border-red-800 rounded-lg bg-red-50/50 dark:bg-red-950/20">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Escalated</p>
                  <p className="text-xs text-muted-foreground">Higher attention required</p>
                </div>
              </div>
              <div className="text-3xl font-bold mb-2">{escalated}</div>
              <Progress
                value={inProgressTickets.length > 0 ? (escalated / inProgressTickets.length) * 100 : 0}
                className="h-2"
              />
            </div>

            <div className="p-5 border-2 border-amber-200 dark:border-amber-800 rounded-lg bg-amber-50/50 dark:bg-amber-950/20">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Pending</p>
                  <p className="text-xs text-muted-foreground">Awaiting admin action</p>
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

      {adminBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Assigned Admins</CardTitle>
            <CardDescription>Ticket distribution across admins handling this category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {adminBreakdown.slice(0, 8).map((admin) => {
                const adminResolutionRate = admin.total > 0 ? Math.round((admin.resolved / admin.total) * 100) : 0;
                return (
                  <div key={admin.id ?? "unassigned"} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold">{admin.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {admin.email || (admin.id ? admin.id : "Unassigned")}
                        </p>
                      </div>
                      <Badge variant="secondary">{admin.total} tickets</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Resolved</p>
                        <p className="text-lg font-bold text-green-600">{admin.resolved}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Resolution Rate</p>
                        <p className="text-lg font-bold">{adminResolutionRate}%</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tickets in {categoryName}</CardTitle>
          <CardDescription>Latest tickets for this category</CardDescription>
        </CardHeader>
        <CardContent>
          {allTickets.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No tickets found for this category yet.</p>
          ) : (
            <div className="space-y-4">
              {allTickets.map((ticket) => {
                // Map to full Ticket type with required fields
                const ticketForCard = {
                  id: ticket.id,
                  title: null,
                  description: ticket.description,
                  location: ticket.location,
                  status_id: 0, // Will be set from status_value if needed
                  category_id: ticket.category_id,
                  subcategory_id: null,
                  sub_subcategory_id: null,
                  created_by: ticket.created_by,
                  assigned_to: ticket.assigned_to,
                  acknowledged_by: null,
                  group_id: null,
                  escalation_level: ticket.escalation_level,
                  tat_extended_count: 0,
                  last_escalation_at: null,
                  acknowledgement_tat_hours: null,
                  resolution_tat_hours: null,
                  acknowledgement_due_at: null,
                  resolution_due_at: ticket.due_at,
                  acknowledged_at: null,
                  reopened_at: null,
                  sla_breached_at: null,
                  reopen_count: 0,
                  rating: ticket.rating,
                  feedback_type: null,
                  rating_submitted: null,
                  feedback: null,
                  is_public: false,
                  admin_link: null,
                  student_link: null,
                  slack_thread_id: null,
                  external_ref: null,
                  metadata: ticket.metadata,
                  created_at: ticket.created_at,
                  updated_at: ticket.updated_at,
                  resolved_at: ticket.resolved_at,
                  status: ticket.status || null,
                  category_name: ticket.category_name || null,
                };
                return (
                  <TicketCard key={ticket.id} ticket={ticketForCard} basePath="/superadmin/dashboard" />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

