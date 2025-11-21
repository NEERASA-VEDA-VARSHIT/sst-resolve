import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, tickets, ticket_statuses } from "@/db";
import { desc, eq } from "drizzle-orm";
import { TicketCard } from "@/components/layout/TicketCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, TrendingUp, Calendar, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";

export default async function SuperAdminEscalatedPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  // Ensure user exists in database
  await getOrCreateUser(userId);

  // Get role from database (single source of truth)
  const role = await getUserRoleFromDB(userId);
  if (role !== "super_admin") redirect("/student/dashboard");

  const allTicketRows = await db
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
    .orderBy(desc(tickets.created_at));

  // Transform to include status field for compatibility
  const allTickets = allTicketRows.map(t => ({
    ...t,
    status: t.status_value || null,
  }));

  const escalated = allTickets.filter(t => (t.escalation_level || 0) > 0);

  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0,0,0,0);
  const endOfToday = new Date(now); endOfToday.setHours(23,59,59,999);

  const isOpen = (s: string | null) => {
    const status = (s || "").toLowerCase();
    return !["closed", "resolved"].includes(status);
  };

  const totalEscalated = escalated.length;
  const openEscalated = escalated.filter(t => isOpen(t.status)).length;
  const escalatedToday = escalated.filter(t => {
    const dt = t.last_escalation_at ? new Date(t.last_escalation_at) : null;
    if (!dt || isNaN(dt.getTime())) return false;
    return dt.getTime() >= startOfToday.getTime() && dt.getTime() <= endOfToday.getTime();
  }).length;

  const sortedEscalated = [...escalated].sort((a, b) => {
    const aCount = a.escalation_level || 0;
    const bCount = b.escalation_level || 0;
    if (bCount !== aCount) return bCount - aCount;
    const aDate = a.last_escalation_at ? new Date(a.last_escalation_at) : null;
    const bDate = b.last_escalation_at ? new Date(b.last_escalation_at) : null;
    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;
    return bDate.getTime() - aDate.getTime();
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">Escalated Tickets</h1>
          <p className="text-muted-foreground text-sm">
            All escalated tickets requiring attention
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/superadmin/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Total Escalated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalEscalated}</div>
            <div className="text-sm text-muted-foreground mt-1">All escalated tickets</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Open Escalated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">{openEscalated}</div>
            <div className="text-sm text-muted-foreground mt-1">Requiring action</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Escalated Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{escalatedToday}</div>
            <div className="text-sm text-muted-foreground mt-1">Last 24 hours</div>
          </CardContent>
        </Card>
      </div>

      {escalated.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TrendingUp className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="font-medium mb-1">No escalated tickets</p>
            <p className="text-sm text-muted-foreground text-center">
              All tickets are being handled smoothly.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Tickets ({escalated.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedEscalated.map((t) => {
              const escalationCount = t.escalation_level || 0;
              return (
                <div key={t.id} className="relative">
                  {escalationCount > 1 && (
                    <div className="absolute -top-2 -right-2 z-10">
                      <Badge variant="destructive" className="rounded-full px-2 py-1 text-xs font-bold">
                        {escalationCount}x
                      </Badge>
                    </div>
                  )}
                  <TicketCard ticket={t as any} basePath="/superadmin/dashboard" />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

