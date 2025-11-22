import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, tickets, ticket_statuses, categories } from "@/db";
import { desc, eq, isNull, or } from "drizzle-orm";
import type { TicketMetadata } from "@/db/types";
import { TicketCard } from "@/components/layout/TicketCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, AlertTriangle, CheckCircle2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCachedAdminUser, getCachedAdminAssignment, getCachedTicketStatuses } from "@/lib/admin/cached-queries";
import { ticketMatchesAdminAssignment } from "@/lib/admin-assignment";

// Revalidate every 30 seconds for fresh data
export const revalidate = 30;

export default async function AdminTodayPendingPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  // Use cached functions for better performance
  const { dbUser, role } = await getCachedAdminUser(userId);
  const isSuperAdmin = role === "super_admin";
  
  if (role === "student") redirect("/student/dashboard");
  if (isSuperAdmin) redirect("/superadmin/dashboard");

  if (!dbUser) {
    console.error("[AdminTodayPendingPage] Failed to create/fetch user");
    redirect("/");
  }

  const adminUserDbId = dbUser.id;

  // Get admin's domain/scope assignment (cached)
  const adminAssignment = await getCachedAdminAssignment(userId);

  // No filters on today page - just show all tickets due today
  const now = new Date();

  // Fetch tickets: assigned to this admin OR unassigned tickets that match admin's domain/scope
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
      category_name: categories.name,
    })
    .from(tickets)
    .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
    .leftJoin(categories, eq(tickets.category_id, categories.id))
    .where(
      or(
        eq(tickets.assigned_to, adminUserDbId),
        isNull(tickets.assigned_to)
      )
    )
    .orderBy(desc(tickets.created_at));

  // Transform to include status and category fields for compatibility
  let allTickets = allTicketRows.map(t => ({
    ...t,
    status: t.status_value || null,
    category: t.category_name || null,
    due_at: t.resolution_due_at,
  }));

  // Filter tickets: show assigned tickets OR unassigned tickets matching domain/scope
  if (adminAssignment.domain) {
    allTickets = allTickets.filter(t => {
      // Priority 1: Always show tickets explicitly assigned to this admin
      // This includes tickets assigned via category_assignments, default_admin_id, etc.
      if (t.assigned_to === adminUserDbId) {
        return true;
      }
      // Priority 2: Show unassigned tickets that match admin's domain/scope
      // This allows admins to pick up unassigned tickets in their domain
      if (!t.assigned_to) {
        // Get category name from join or metadata
        const categoryName = t.category_name || (t.metadata && typeof t.metadata === "object" ? (t.metadata as Record<string, unknown>).category as string | null : null);
        return ticketMatchesAdminAssignment(
          { category: categoryName, location: t.location },
          adminAssignment
        );
      }
      return false;
    });
  } else {
    // If admin has no domain assignment, only show tickets assigned to them
    allTickets = allTickets.filter(t => t.assigned_to === adminUserDbId);
  }

  // Get today's date in local timezone (year, month, day only)
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDate = now.getDate();
  // Note: startOfToday and endOfToday are calculated but not used in current logic
  // const startOfToday = new Date(todayYear, todayMonth, todayDate, 0, 0, 0, 0);
  // const endOfToday = new Date(todayYear, todayMonth, todayDate, 23, 59, 59, 999);

  // "Pending today": tickets with TAT date falling today (should be resolved today)
  // Fetch dynamic ticket statuses (cached)
  const ticketStatuses = await getCachedTicketStatuses();
  const pendingStatuses = new Set(ticketStatuses.filter(s => !s.is_final).map(s => s.value));

  const todayPending = allTickets.filter(t => {
    try {
      const status = (t.status || "").toLowerCase();
      if (!pendingStatuses.has(status)) return false;

      // Check resolution_due_at first (authoritative)
      if (t.resolution_due_at) {
        const dueDate = new Date(t.resolution_due_at);
        if (!isNaN(dueDate.getTime())) {
          const dueYear = dueDate.getFullYear();
          const dueMonth = dueDate.getMonth();
          const dueDay = dueDate.getDate();
          return dueYear === todayYear && dueMonth === todayMonth && dueDay === todayDate;
        }
      }

      // Fallback to metadata
      if (t.metadata && typeof t.metadata === "object") {
        const metadata = t.metadata as TicketMetadata;
        if (metadata?.tatDate && typeof metadata.tatDate === 'string') {
          const tatDate = new Date(metadata.tatDate);
          if (!isNaN(tatDate.getTime())) {
            const tatYear = tatDate.getFullYear();
            const tatMonth = tatDate.getMonth();
            const tatDay = tatDate.getDate();
            return tatYear === todayYear && tatMonth === todayMonth && tatDay === todayDate;
          }
        }
      }

      // Legacy fallback to metadata JSON
      if (t.metadata && typeof t.metadata === "object") {
        try {
          const d = t.metadata as TicketMetadata;
          if (d?.tatDate && typeof d.tatDate === 'string') {
            const tatDate = new Date(d.tatDate);
            if (!isNaN(tatDate.getTime())) {
              const tatYear = tatDate.getFullYear();
              const tatMonth = tatDate.getMonth();
              const tatDay = tatDate.getDate();
              return tatYear === todayYear && tatMonth === todayMonth && tatDay === todayDate;
            }
          }
        } catch {
          // Invalid JSON, continue
        }
      }

      return false;
    } catch (error) {
      console.error("[AdminTodayPendingPage] Error filtering ticket:", error, t.id);
      return false;
    }
  });

  // Sort tickets by urgency (overdue first, then by TAT time)
  const sortedTodayPending = [...todayPending].sort((a, b) => {
    try {
      const getTatDate = (t: typeof a): Date | null => {
        if (t.resolution_due_at) {
          const date = new Date(t.resolution_due_at);
          return !isNaN(date.getTime()) ? date : null;
        }
        if (t.metadata && typeof t.metadata === "object") {
          const metadata = t.metadata as TicketMetadata;
          if (metadata?.tatDate && typeof metadata.tatDate === 'string') {
            const date = new Date(metadata.tatDate);
            return !isNaN(date.getTime()) ? date : null;
          }
        }
        return null;
      };

      const aTat = getTatDate(a);
      const bTat = getTatDate(b);

      if (!aTat && !bTat) return 0;
      if (!aTat) return 1;
      if (!bTat) return -1;

      const aOverdue = aTat.getTime() < now.getTime();
      const bOverdue = bTat.getTime() < now.getTime();

      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      return aTat.getTime() - bTat.getTime();
    } catch {
      return 0;
    }
  });

  // Calculate overdue count
  const overdueIds = new Set(
    todayPending
      .filter(t => {
        try {
          const status = (t.status || "").toUpperCase();
          if (status === "AWAITING_STUDENT" || status === "AWAITING_STUDENT_RESPONSE") {
            return false;
          }
          if (t.due_at) {
            const dueDate = new Date(t.due_at);
            if (!isNaN(dueDate.getTime())) {
              return dueDate.getTime() < now.getTime();
            }
          }
          if (t.metadata && typeof t.metadata === "object") {
            const metadata = t.metadata as TicketMetadata;
            if (metadata?.tatDate && typeof metadata.tatDate === 'string') {
              const tatDate = new Date(metadata.tatDate);
              if (!isNaN(tatDate.getTime())) {
                return tatDate.getTime() < now.getTime();
              }
            }
          }
          return false;
        } catch {
          return false;
        }
      })
      .map(t => t.id)
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">Today Pending</h1>
          <p className="text-muted-foreground text-sm">
            Tickets with TAT due today
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
        </Button>
      </div>

      {/* Simple Stats */}

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
            <div className="text-sm text-muted-foreground mt-1">
              TAT due today
            </div>
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
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{overdueIds.size}</div>
            <div className="text-sm text-muted-foreground mt-1">Past TAT deadline</div>
          </CardContent>
        </Card>
      </div>

      {todayPending.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="font-medium mb-1">
              {todayPending.length === 0 ? "All clear!" : "No tickets match your filters"}
            </p>
            <p className="text-sm text-muted-foreground text-center">
              {todayPending.length === 0 
                ? "No tickets with TAT due today."
                : `Try adjusting your filters to see more results.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Tickets ({todayPending.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedTodayPending.map((t) => {
              const isOverdue = overdueIds.has(t.id);
              return (
                <div key={t.id} className={isOverdue ? "ring-2 ring-orange-400 dark:ring-orange-500 rounded-lg" : ""}>
                  <TicketCard ticket={{
                    ...t,
                    status: t.status_value || null,
                    category_name: t.category_name || null,
                  }} basePath="/admin/dashboard" />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}



