import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, tickets, ticket_statuses } from "@/db";
import { desc, eq } from "drizzle-orm";
import type { TicketMetadata } from "@/db/types";
import { TicketCard } from "@/components/layout/TicketCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, AlertTriangle, CheckCircle2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";

export default async function SuperAdminTodayPendingPage() {
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

  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDate = now.getDate();

  const pendingStatuses = new Set(["open", "in_progress", "awaiting_student_response", "reopened"]);

  const todayPending = allTickets.filter(t => {
    const status = (t.status || "").toLowerCase();
    const hasPendingStatus = pendingStatuses.has(status);
    
    if (!hasPendingStatus) return false;
    
    // Use authoritative resolution_due_at field first, fallback to metadata
    const metadata = (t.metadata as TicketMetadata) || {};
    const tatDate = t.resolution_due_at || (metadata?.tatDate && typeof metadata.tatDate === 'string' ? new Date(metadata.tatDate) : null);
    
    if (!tatDate || isNaN(tatDate.getTime())) return false;
    
    const tatYear = tatDate.getFullYear();
    const tatMonth = tatDate.getMonth();
    const tatDay = tatDate.getDate();
    
    const tatIsToday = 
      tatYear === todayYear &&
      tatMonth === todayMonth &&
      tatDay === todayDate;
    
    return tatIsToday;
  });

  const overdueToday = allTickets.filter(t => {
    const status = (t.status || "").toLowerCase();
    if (!pendingStatuses.has(status)) return false;
    
    // Exclude tickets awaiting student response from overdue
    const statusUpper = (t.status || "").toUpperCase();
    if (statusUpper === "AWAITING_STUDENT" || statusUpper === "AWAITING_STUDENT_RESPONSE") {
      return false;
    }
    
    // Use authoritative resolution_due_at field first, fallback to metadata
    const metadata = (t.metadata as TicketMetadata) || {};
    const tatDate = t.resolution_due_at || (metadata?.tatDate && typeof metadata.tatDate === 'string' ? new Date(metadata.tatDate) : null);
    
    if (!tatDate || isNaN(tatDate.getTime())) return false;
    
    const tatYear = tatDate.getFullYear();
    const tatMonth = tatDate.getMonth();
    const tatDay = tatDate.getDate();
    
    const tatIsToday = 
      tatYear === todayYear &&
      tatMonth === todayMonth &&
      tatDay === todayDate;
    
    if (tatIsToday) return false;
    
    const tatTime = new Date(tatYear, tatMonth, tatDay).getTime();
    const todayTime = new Date(todayYear, todayMonth, todayDate).getTime();
    
    return tatTime < todayTime;
  });

  const overdueTodayIds = new Set(overdueToday.map(t => t.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">Today Pending</h1>
          <p className="text-muted-foreground text-sm">
            Tickets with TAT due today
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/superadmin/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Total Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{todayPending.length}</div>
            <div className="text-sm text-muted-foreground mt-1">Due today</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{overdueToday.length}</div>
            <div className="text-sm text-muted-foreground mt-1">Past TAT date</div>
          </CardContent>
        </Card>
      </div>

      {todayPending.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="font-medium mb-1">No tickets pending today</p>
            <p className="text-sm text-muted-foreground text-center">
              All tickets are on track.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Tickets ({todayPending.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {todayPending.map((t) => (
              <div key={t.id} className={overdueTodayIds.has(t.id) ? "ring-2 ring-orange-400 dark:ring-orange-500 rounded-lg" : ""}>
                <TicketCard ticket={{
                  ...t,
                  status: t.status_value || null,
                  category_name: null,
                }} basePath="/superadmin/dashboard" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

