import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, tickets } from "@/db";
import { desc } from "drizzle-orm";
import { TicketCard } from "@/components/layout/TicketCard";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { AdminTicketFilters } from "@/components/admin/AdminTicketFilters";
import { Button } from "@/components/ui/button";
import { FileText, Clock, CheckCircle2, AlertCircle, Users, BarChart3, Calendar, TrendingUp, Shield, Globe } from "lucide-react";
import { StatsCards } from "@/components/dashboard/StatsCards";

export default async function SuperAdminDashboardPage({ searchParams }: { searchParams?: Promise<Record<string, string>> }) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect("/");
  }

  const role = sessionClaims?.metadata?.role || 'student';

  if (role !== 'super_admin') {
    redirect('/student/dashboard');
  }

  const params = (await (searchParams || Promise.resolve({}))) || {};
  const category = params["category"] || "";
  const subcategory = params["subcategory"] || "";
  const location = params["location"] || "";
  const tat = params["tat"] || "";
  const status = params["status"] || "";
  const createdFrom = params["from"] || "";
  const createdTo = params["to"] || "";
  const user = params["user"] || "";
  const sort = params["sort"] || "newest";

  let allTickets = await db.select().from(tickets).orderBy(desc(tickets.createdAt));

  if (category) {
    allTickets = allTickets.filter(t => (t.category || "").toLowerCase() === category.toLowerCase());
  }
  if (subcategory) {
    allTickets = allTickets.filter(t => (t.subcategory || "").toLowerCase().includes(subcategory.toLowerCase()));
  }
  if (location) {
    allTickets = allTickets.filter(t => (t.location || "").toLowerCase().includes(location.toLowerCase()));
  }
  if (status) {
    if (status.toLowerCase() === "resolved") {
      allTickets = allTickets.filter(t => t.status === "resolved" || t.status === "closed");
    } else {
      allTickets = allTickets.filter(t => (t.status || "").toLowerCase() === status.toLowerCase());
    }
  }
  if (user) {
    allTickets = allTickets.filter(t => (t.userNumber || "").toLowerCase().includes(user.toLowerCase()));
  }
  if (createdFrom) {
    const from = new Date(createdFrom);
    from.setHours(0,0,0,0);
    allTickets = allTickets.filter(t => t.createdAt ? new Date(t.createdAt).getTime() >= from.getTime() : false);
  }
  if (createdTo) {
    const to = new Date(createdTo);
    to.setHours(23,59,59,999);
    allTickets = allTickets.filter(t => t.createdAt ? new Date(t.createdAt).getTime() <= to.getTime() : false);
  }

  if (tat) {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    allTickets = allTickets.filter(t => {
      if (!t.details) return tat === "none";
      try {
        const d = JSON.parse(t.details as any);
        const hasTat = !!d.tat;
        const tatDate = d.tatDate ? new Date(d.tatDate) : null;
        if (tat === "has") return hasTat;
        if (tat === "none") return !hasTat;
        if (tat === "due") return hasTat && tatDate && tatDate.getTime() < now.getTime();
        if (tat === "upcoming") return hasTat && tatDate && tatDate.getTime() >= now.getTime();
        if (tat === "today") {
          return hasTat && tatDate && tatDate.getTime() >= startOfToday.getTime() && tatDate.getTime() <= endOfToday.getTime();
        }
        return true;
      } catch {
        return tat === "none";
      }
    });
  }

  if (sort === "oldest") {
    allTickets = [...allTickets].reverse();
  }


  const stats = {
    total: allTickets.length,
    open: allTickets.filter(t => t.status === 'open').length,
    inProgress: allTickets.filter(t => t.status === 'in_progress').length,
    resolved: allTickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
    escalated: allTickets.filter(t => (Number(t.escalationCount) || 0) > 0).length,
  };

  // Calculate today pending count
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const todayPending = allTickets.filter(t => {
    const status = (t.status || "").toLowerCase();
    if (!["open", "in_progress", "awaiting_student_response", "reopened"].includes(status)) return false;
    try {
      const d = t.details ? JSON.parse(String(t.details)) : {};
      const tatDate = d.tatDate ? new Date(d.tatDate) : null;
      if (!tatDate) return false;
      return tatDate.getTime() >= startOfToday.getTime() && tatDate.getTime() <= endOfToday.getTime();
    } catch {
      return false;
    }
  }).length;

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Super Admin Dashboard
            </h1>
            <p className="text-muted-foreground">
              Comprehensive overview of all tickets and user management
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" asChild>
              <Link href="/public">
                <Globe className="w-4 h-4 mr-2" />
                Public Dashboard
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/superadmin/dashboard/today">
                <Calendar className="w-4 h-4 mr-2" />
                Today Pending
                {todayPending > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-amber-500 text-white">
                    {todayPending}
                  </span>
                )}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/superadmin/dashboard/escalated">
                <AlertCircle className="w-4 h-4 mr-2" />
                Escalated
                {stats.escalated > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-red-500 text-white">
                    {stats.escalated}
                  </span>
                )}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/superadmin/dashboard/committee">
                <Users className="w-4 h-4 mr-2" />
                Committee
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/superadmin/tickets">
                <FileText className="w-4 h-4 mr-2" />
                All Tickets View
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/superadmin/dashboard/users">
                <Users className="w-4 h-4 mr-2" />
                User & Staff Management
              </Link>
            </Button>
          </div>
        </div>

        <div className="space-y-6">
            <AdminTicketFilters />

            <StatsCards stats={stats} />

            <div className="flex justify-between items-center pt-4">
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <FileText className="w-6 h-6" />
                All Tickets (Super Admin View)
              </h2>
              <p className="text-sm text-muted-foreground">
                {allTickets.length} {allTickets.length === 1 ? 'ticket' : 'tickets'}
              </p>
            </div>

            {allTickets.length === 0 ? (
              <Card className="border-2 border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-semibold mb-1">No tickets found</p>
                  <p className="text-sm text-muted-foreground text-center max-w-md">
                    All system tickets will appear here. Use the filters above to search for specific tickets.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {allTickets.map((ticket) => (
                  <TicketCard key={ticket.id} ticket={ticket} basePath="/superadmin/dashboard" />
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

