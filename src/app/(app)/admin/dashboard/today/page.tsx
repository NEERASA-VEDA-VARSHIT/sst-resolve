import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, tickets } from "@/db";
import { desc, eq, isNull, or } from "drizzle-orm";
import { TicketCard } from "@/components/layout/TicketCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, AlertTriangle, CheckCircle2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function AdminTodayPendingPage() {
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
    )
    .orderBy(desc(tickets.createdAt));

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
  // Get today's date in local timezone (year, month, day only)
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDate = now.getDate();

  // Debug: Log today's date
  console.log("Today's date:", { year: todayYear, month: todayMonth, date: todayDate });
  console.log("Total tickets fetched:", allTickets.length);

  // "Pending today": tickets with TAT date falling today (should be resolved today)
  const pendingStatuses = new Set(["open", "in_progress", "awaiting_student_response", "reopened"]);

  // Debug: Count tickets with TAT dates
  let ticketsWithTat = 0;
  let ticketsWithPendingStatus = 0;

  const todayPending = allTickets.filter(t => {
    const status = (t.status || "").toLowerCase();
    const hasPendingStatus = pendingStatuses.has(status);
    if (hasPendingStatus) ticketsWithPendingStatus++;
    
    if (!hasPendingStatus) return false;
    
    // Include tickets where TAT date is today OR overdue (past TAT but still pending)
    try {
      const d = t.details ? JSON.parse(String(t.details)) : {};
      if (!d.tatDate) return false;
      
      ticketsWithTat++;
      
      // Parse TAT date (could be ISO string or other format)
      const tatDate = new Date(d.tatDate);
      if (isNaN(tatDate.getTime())) {
        console.log("Invalid TAT date for ticket", t.id, d.tatDate);
        return false;
      }
      
      // Get date parts in local timezone (JavaScript Date automatically converts UTC to local)
      const tatYear = tatDate.getFullYear();
      const tatMonth = tatDate.getMonth();
      const tatDay = tatDate.getDate();
      
      // Check if TAT is today (compare by date only, ignoring time)
      const tatIsToday = 
        tatYear === todayYear &&
        tatMonth === todayMonth &&
        tatDay === todayDate;
      
      // Debug: Log TAT date comparison for first few tickets
      if (ticketsWithTat <= 5) {
        console.log(`Ticket ${t.id} TAT:`, {
          tatDateString: d.tatDate,
          parsedISO: tatDate.toISOString(),
          localDate: `${tatYear}-${String(tatMonth + 1).padStart(2, '0')}-${String(tatDay).padStart(2, '0')}`,
          todayDate: `${todayYear}-${String(todayMonth + 1).padStart(2, '0')}-${String(todayDate).padStart(2, '0')}`,
          isToday: tatIsToday
        });
      }
      
      return tatIsToday;
    } catch (error) {
      // Log error for debugging but don't break the filter
      console.error("Error parsing ticket details for TAT:", error, t.id);
      return false;
    }
  });

  // Debug: Log results
  console.log("Tickets with pending status:", ticketsWithPendingStatus);
  console.log("Tickets with TAT date:", ticketsWithTat);
  console.log("Tickets with TAT due today:", todayPending.length);

  // Calculate additional metrics - create a Set of overdue ticket IDs for efficient lookup
  const overdueTodayIds = new Set(
    todayPending
      .filter(t => {
        try {
          const d = t.details ? JSON.parse(String(t.details)) : {};
          const tatDate = d.tatDate ? new Date(d.tatDate) : null;
          if (!tatDate) return false;
          return tatDate.getTime() < now.getTime();
        } catch {
          return false;
        }
      })
      .map(t => t.id)
  );

  // Sort by urgency (overdue first, then by TAT time)
  const sortedTodayPending = [...todayPending].sort((a, b) => {
    try {
      const aDetails = a.details ? JSON.parse(String(a.details)) : {};
      const bDetails = b.details ? JSON.parse(String(b.details)) : {};
      const aTat = aDetails.tatDate ? new Date(aDetails.tatDate) : null;
      const bTat = bDetails.tatDate ? new Date(bDetails.tatDate) : null;
      
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
            <div className="text-sm text-muted-foreground mt-1">TAT due today</div>
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
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{overdueTodayIds.size}</div>
            <div className="text-sm text-muted-foreground mt-1">Past TAT deadline</div>
          </CardContent>
        </Card>
      </div>

      {todayPending.length === 0 ? (
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
            Tickets ({todayPending.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedTodayPending.map((t) => {
              const isOverdue = overdueTodayIds.has(t.id);
              return (
                <div key={t.id} className={isOverdue ? "ring-2 ring-orange-400 dark:ring-orange-500 rounded-lg" : ""}>
                  <TicketCard ticket={t as any} basePath="/admin/dashboard" />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


