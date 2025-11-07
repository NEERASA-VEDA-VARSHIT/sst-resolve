import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, tickets } from "@/db";
import { desc, eq, or, isNull } from "drizzle-orm";
import { TicketCard } from "@/components/layout/TicketCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import Link from "next/link";
import { clerkClient } from "@clerk/nextjs/server";
import { UserManagement } from "@/components/admin/UserManagement";
import { AdminTicketFilters } from "@/components/admin/AdminTicketFilters";

export default async function AdminDashboardPage({ searchParams }: { searchParams?: Promise<Record<string, string>> }) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect("/");
  }

  // The middleware already handles role-based access control
  const role = sessionClaims?.metadata?.role || 'student';
  const isSuperAdmin = role === 'super_admin';

  // Redirect super_admin to their own dashboard
  if (isSuperAdmin) {
    redirect('/dashboard/superadmin');
  }

  // Only admin and super_admin can access
  if (role === 'student') {
    redirect('/dashboard/student');
  }

  const params = (await (searchParams || Promise.resolve({}))) || {};
  const activeTab = params["tab"] || "tickets";
  const category = params["category"] || "";
  const subcategory = params["subcategory"] || "";
  const location = params["location"] || "";
  const tat = params["tat"] || "";
  const status = params["status"] || "";
  const createdFrom = params["from"] || "";
  const createdTo = params["to"] || "";
  const user = params["user"] || "";
  const sort = params["sort"] || "newest";

  // Get admin's userId for filtering
  const adminUserId = userId;
  
  // Base query - only show tickets assigned to this admin OR unassigned tickets
  // Admins can see tickets assigned to them or unassigned tickets (not assigned to anyone)
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

  // Apply server-side filters for simple columns
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
    allTickets = allTickets.filter(t => (t.status || "").toLowerCase() === status.toLowerCase());
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

  // TAT filters require parsing details JSON
  if (tat) {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    allTickets = allTickets.filter(t => {
      if (!t.details) return tat === "none"; // no details -> treat as no TAT
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

  // Apply sorting
  if (sort === "oldest") {
    allTickets = [...allTickets].reverse();
  }

  // Get all users for role management (only for super_admin)
  const client = await clerkClient();
  const userList = await client.users.getUserList();

  // Transform Clerk user objects to plain objects for client component
  const users = userList.data.map(user => {
    const emailAddresses = Array.isArray(user.emailAddresses)
      ? user.emailAddresses.map((email: any) => ({
          emailAddress: typeof email?.emailAddress === 'string' ? email.emailAddress : ''
        }))
      : [];

    const publicMetadata = user.publicMetadata && typeof user.publicMetadata === 'object'
      ? { role: (user.publicMetadata as any)?.role || undefined }
      : { role: undefined };

    return {
      id: String(user.id || ''),
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      emailAddresses,
      publicMetadata
    };
  });

  // Calculate stats
  const stats = {
    total: allTickets.length,
    open: allTickets.filter(t => t.status === 'open').length,
    closed: allTickets.filter(t => t.status === 'closed').length,
    inProgress: allTickets.filter(t => t.status && t.status !== 'open' && t.status !== 'closed').length,
  };

  // Calculate category-wise counters
  const categoryCounts = {
    Hostel: allTickets.filter(t => t.category === 'Hostel').length,
    College: allTickets.filter(t => t.category === 'College').length,
  };

  // Count by status for each category
  const categoryStatusCounts = {
    Hostel: {
      open: allTickets.filter(t => t.category === 'Hostel' && t.status === 'open').length,
      inProgress: allTickets.filter(t => t.category === 'Hostel' && t.status === 'in_progress').length,
      closed: allTickets.filter(t => t.category === 'Hostel' && t.status === 'closed').length,
    },
    College: {
      open: allTickets.filter(t => t.category === 'College' && t.status === 'open').length,
      inProgress: allTickets.filter(t => t.category === 'College' && t.status === 'in_progress').length,
      closed: allTickets.filter(t => t.category === 'College' && t.status === 'closed').length,
    },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
        {/* Tabs */}
        <Tabs defaultValue="tickets" value={activeTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="tickets" asChild>
              <Link href="/dashboard/admin">Tickets</Link>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tickets" className="space-y-6">
            {/* Filters */}
            <AdminTicketFilters />

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground mb-1">Total Tickets</p>
                  <p className="text-3xl font-bold">{stats.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground mb-1">Open</p>
                  <p className="text-3xl font-bold text-green-600">{stats.open}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground mb-1">In Progress</p>
                  <p className="text-3xl font-bold text-yellow-600">{stats.inProgress}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground mb-1">Closed</p>
                  <p className="text-3xl font-bold text-gray-600">{stats.closed}</p>
                </CardContent>
              </Card>
            </div>

            {/* Category Counters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground mb-2 font-medium">Hostel Tickets</p>
                  <p className="text-2xl font-bold mb-2">{categoryCounts.Hostel}</p>
                  <div className="flex gap-4 text-xs">
                    <span className="text-green-600">Open: {categoryStatusCounts.Hostel.open}</span>
                    <span className="text-yellow-600">In Progress: {categoryStatusCounts.Hostel.inProgress}</span>
                    <span className="text-gray-600">Closed: {categoryStatusCounts.Hostel.closed}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground mb-2 font-medium">College Tickets</p>
                  <p className="text-2xl font-bold mb-2">{categoryCounts.College}</p>
                  <div className="flex gap-4 text-xs">
                    <span className="text-green-600">Open: {categoryStatusCounts.College.open}</span>
                    <span className="text-yellow-600">In Progress: {categoryStatusCounts.College.inProgress}</span>
                    <span className="text-gray-600">Closed: {categoryStatusCounts.College.closed}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">My Assigned Tickets</h2>
            </div>

            {allTickets.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No tickets found.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {allTickets.map((ticket) => (
                  <TicketCard key={ticket.id} ticket={ticket} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
