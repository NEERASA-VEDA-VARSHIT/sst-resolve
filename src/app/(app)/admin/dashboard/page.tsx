import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, tickets } from "@/db";
import { desc, eq, or, isNull } from "drizzle-orm";
import { TicketCard } from "@/components/layout/TicketCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { clerkClient } from "@clerk/nextjs/server";
import { AdminTicketFilters } from "@/components/admin/AdminTicketFilters";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { Button } from "@/components/ui/button";
import { FileText, Clock, CheckCircle2, AlertCircle, TrendingUp, Calendar, Users, Globe } from "lucide-react";

export default async function AdminDashboardPage({ searchParams }: { searchParams?: Promise<Record<string, string>> }) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect("/");
  }

  const role = sessionClaims?.metadata?.role || 'student';
  const isSuperAdmin = role === 'super_admin';

  if (isSuperAdmin) {
    redirect('/superadmin/dashboard');
  }

  if (role === 'student') {
    redirect('/student/dashboard');
  }

  const params = (await (searchParams || Promise.resolve({}))) || {};
  const activeTab = params["tab"] || "tickets";
  const searchQuery = params["search"] || "";
  const category = params["category"] || "";
  const subcategory = params["subcategory"] || "";
  const location = params["location"] || "";
  const tat = params["tat"] || "";
  const status = params["status"] || "";
  const createdFrom = params["from"] || "";
  const createdTo = params["to"] || "";
  const user = params["user"] || "";
  const sort = params["sort"] || "newest";
  const escalated = params["escalated"] || "";

  const adminUserId = userId;

  // Get admin's domain/scope assignment
  const { getAdminAssignment, ticketMatchesAdminAssignment } = await import("@/lib/admin-assignment");
  const adminAssignment = await getAdminAssignment(adminUserId);
  const hasAssignment = !!adminAssignment.domain;

  // Fetch tickets
  let allTickets = await db
    .select()
    .from(tickets)
    .where(
      hasAssignment
        ? eq(tickets.assignedTo, adminUserId)
        : or(eq(tickets.assignedTo, adminUserId), isNull(tickets.assignedTo))
    )
    .orderBy(desc(tickets.createdAt));

  if (hasAssignment) {
    allTickets = allTickets.filter(t =>
      t.assignedTo === adminUserId &&
      ticketMatchesAdminAssignment(
        { category: t.category, location: t.location },
        adminAssignment
      )
    );
  }

  // If admin has no assignment, allow viewing matching unassigned tickets (legacy behaviour)
  if (!hasAssignment) {
    allTickets = allTickets.filter(t => {
      if (t.assignedTo === adminUserId) return true;
      if (!t.assignedTo) {
        return ticketMatchesAdminAssignment(
          { category: t.category, location: t.location },
          adminAssignment
        );
      }
      return false;
    });
  }

  // Search filter (searches across ID, description, user number, and subcategory)
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    allTickets = allTickets.filter(t => {
      const idMatch = t.id.toString().includes(query);
      const descMatch = (t.description || "").toLowerCase().includes(query);
      const userMatch = (t.userNumber || "").toLowerCase().includes(query);
      const subcatMatch = (t.subcategory || "").toLowerCase().includes(query);
      return idMatch || descMatch || userMatch || subcatMatch;
    });
  }

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
  if (escalated === "true") {
    allTickets = allTickets.filter(t => (Number(t.escalationCount) || 0) > 0);
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

  const client = await clerkClient();
  const userList = await client.users.getUserList();
  const users = userList.data.map(user => ({
    id: String(user.id || ''),
    firstName: user.firstName || null,
    lastName: user.lastName || null,
    emailAddresses: Array.isArray(user.emailAddresses)
      ? user.emailAddresses.map((email: any) => ({ emailAddress: typeof email?.emailAddress === 'string' ? email.emailAddress : '' }))
      : [],
    publicMetadata: user.publicMetadata && typeof user.publicMetadata === 'object'
      ? { role: (user.publicMetadata as any)?.role || undefined }
      : { role: undefined },
  }));

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
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground">
              Manage and monitor all assigned tickets
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/public">
                <Globe className="w-4 h-4 mr-2" />
                Public Dashboard
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/dashboard/today">
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
              <Link href="/admin/dashboard/escalated">
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
              <Link href="/admin/dashboard/analytics">
                <TrendingUp className="w-4 h-4 mr-2" />
                Analytics
              </Link>
            </Button>
          </div>
        </div>

        <Tabs defaultValue="tickets" value={activeTab} className="w-full">
          <TabsList className="mb-6 bg-muted/50">
            <TabsTrigger value="tickets" asChild>
              <Link href="/admin/dashboard">Tickets</Link>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tickets" className="space-y-6">
            {/* Stats Cards */}
            <StatsCards stats={stats} />

            <AdminTicketFilters />

            <div className="flex justify-between items-center pt-4">
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <FileText className="w-6 h-6" />
                My Assigned Tickets
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
                    Tickets assigned to you will appear here. Use the filters above to search for specific tickets.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {allTickets.map((ticket) => (
                  <TicketCard key={ticket.id} ticket={ticket} basePath="/admin/dashboard" />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

