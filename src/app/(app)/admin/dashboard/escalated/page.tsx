import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, tickets, staff } from "@/db";
import { desc, eq, isNull, or } from "drizzle-orm";
import { TicketCard } from "@/components/layout/TicketCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, TrendingUp, Calendar, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";
import { getTicketStatuses } from "@/lib/status/getTicketStatuses";

export default async function AdminEscalatedAnalyticsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  // Ensure user exists in database
  await getOrCreateUser(userId);

  // Get role from database (single source of truth)
  const role = await getUserRoleFromDB(userId);
  const isSuperAdmin = role === "super_admin";
  if (role === "student") redirect("/student/dashboard");
  if (isSuperAdmin) redirect("/superadmin/dashboard");

  const adminUserId = userId;

  // Get admin's domain/scope assignment
  const { getAdminAssignment, ticketMatchesAdminAssignment } = await import("@/lib/admin-assignment");
  const adminAssignment = await getAdminAssignment(adminUserId);

  // Get admin's staff record
  const dbUser = await getOrCreateUser(adminUserId);
  if (!dbUser) {
    console.error("[AdminEscalatedAnalyticsPage] Failed to create/fetch user");
    redirect("/");
  }

  const [adminStaff] = await db
    .select({ id: staff.id })
    .from(staff)
    .where(eq(staff.user_id, dbUser.id))
    .limit(1);

  if (!adminStaff) {
    return (
      <div className="space-y-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No staff assignment found. Please contact super admin.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch tickets: assigned to this admin OR unassigned tickets that match admin's domain/scope
  let allTickets = await db
    .select()
    .from(tickets)
    .where(
      or(
        eq(tickets.assigned_to, adminStaff.id),
        isNull(tickets.assigned_to)
      )
    )
    .orderBy(desc(tickets.created_at));

  // Filter unassigned tickets to only show those matching admin's domain/scope
  if (adminAssignment.domain) {
    allTickets = allTickets.filter(t => {
      // If assigned to this admin, always show
      if (t.assigned_to === adminStaff.id) {
        return true;
      }
      // If unassigned, only show if matches admin's domain/scope
      if (!t.assigned_to) {
        const categoryName = t.category || (t.metadata && typeof t.metadata === "object" ? (t.metadata as any).category : null);
        return ticketMatchesAdminAssignment(
          { category: categoryName, location: t.location },
          adminAssignment
        );
      }
      return false;
    });
  }

  // Filter to only escalated tickets
  const escalated = allTickets.filter(t => {
    const level = t.escalation_level;
    return typeof level === "number" && level > 0;
  });

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  // Fetch dynamic ticket statuses
  const ticketStatuses = await getTicketStatuses();
  const finalStatuses = new Set(ticketStatuses.filter(s => s.is_final).map(s => s.value));

  const isOpen = (s: string | null) => !finalStatuses.has(s || "");

  const totalEscalated = escalated.length;
  const openEscalated = escalated.filter(t => isOpen(t.status)).length;
  const escalatedToday = escalated.filter(t => {
    try {
      if (!t.last_escalation_at) return false;
      const dt = new Date(t.last_escalation_at);
      if (isNaN(dt.getTime())) return false;
      return dt.getTime() >= startOfToday.getTime() && dt.getTime() <= endOfToday.getTime();
    } catch {
      return false;
    }
  }).length;

  // Sort by escalation count (most escalated first)
  const sortedEscalated = [...escalated].sort((a, b) => {
    const aCount = typeof a.escalation_level === "number" ? a.escalation_level : 0;
    const bCount = typeof b.escalation_level === "number" ? b.escalation_level : 0;
    if (bCount !== aCount) return bCount - aCount;

    const aDate = a.last_escalation_at ? new Date(a.last_escalation_at) : null;
    const bDate = b.last_escalation_at ? new Date(b.last_escalation_at) : null;
    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;
    if (isNaN(aDate.getTime()) || isNaN(bDate.getTime())) return 0;
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
          <Link href="/admin/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
        </Button>
      </div>

      {/* Simple Stats */}
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
              const escalationCount = typeof t.escalation_level === "number" ? t.escalation_level : 0;
              return (
                <div key={t.id} className="relative">
                  {escalationCount > 1 && (
                    <div className="absolute -top-2 -right-2 z-10">
                      <Badge variant="destructive" className="rounded-full px-2 py-1 text-xs font-bold">
                        {escalationCount}x
                      </Badge>
                    </div>
                  )}
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
