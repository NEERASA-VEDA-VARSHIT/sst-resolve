import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { TicketMetadata } from "@/db/types";
import { TicketCard } from "@/components/layout/TicketCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, AlertTriangle, CheckCircle2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCachedAdminUser, getCachedAdminAssignment, getCachedTicketStatuses, getCachedAdminTickets } from "@/lib/cache/cached-queries";
import { ticketMatchesAdminAssignment } from "@/lib/assignment/admin-assignment";

// Revalidate every 30 seconds for fresh data
export const revalidate = 30;

export default async function AdminTodayPendingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  // Use cached functions for better performance - parallelize queries
  const [{ dbUser, role }, adminAssignment, ticketStatuses] = await Promise.all([
    getCachedAdminUser(userId),
    getCachedAdminAssignment(userId),
    getCachedTicketStatuses(),
  ]);

  const isSuperAdmin = role === "super_admin";
  
  if (role === "student") redirect("/student/dashboard");
  if (isSuperAdmin) redirect("/superadmin/dashboard");

  if (!dbUser) {
    console.error("[AdminTodayPendingPage] Failed to create/fetch user");
    redirect("/");
  }

  const adminUserDbId = dbUser.id;

  // No filters on today page - just show all tickets due today
  const now = new Date();

  // Use cached admin tickets function for better performance
  const allTicketRows = await getCachedAdminTickets(adminUserDbId, adminAssignment);

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
      if (t.assigned_to === adminUserDbId) {
        return true;
      }
      // Priority 2: Show unassigned tickets that match admin's domain/scope
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

  // "Pending today": tickets with TAT date falling today (should be resolved today)
  // Use already fetched ticket statuses
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

  // Calculate overdue count from sorted tickets for consistency
  const overdueIds = new Set(
    sortedTodayPending
      .filter(t => {
        try {
          const status = (t.status || "").toUpperCase();
          if (status === "AWAITING_STUDENT" || status === "AWAITING_STUDENT_RESPONSE") {
            return false;
          }
          if (t.resolution_due_at) {
            const dueDate = new Date(t.resolution_due_at);
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
            <div className="text-3xl font-bold">{sortedTodayPending.length}</div>
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

      {sortedTodayPending.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="font-medium mb-1">All clear!</p>
            <p className="text-sm text-muted-foreground text-center">
              No tickets with TAT due today.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Tickets ({sortedTodayPending.length})
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




