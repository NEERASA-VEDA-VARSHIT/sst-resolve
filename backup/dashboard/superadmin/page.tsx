import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, tickets } from "@/db";
import { desc } from "drizzle-orm";
import { TicketCard } from "@/components/layout/TicketCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import Link from "next/link";
import { clerkClient } from "@clerk/nextjs/server";
import { UserManagement } from "@/components/admin/UserManagement";
import { AdminTicketFilters } from "@/components/admin/AdminTicketFilters";
// Actions imported by UserManagement component

export default async function SuperAdminDashboardPage({ searchParams }: { searchParams?: Promise<Record<string, string>> }) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect("/");
  }

  const role = sessionClaims?.metadata?.role || 'student';

  // Only super_admin can access
  if (role !== 'super_admin') {
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

  // Base query
  let allTickets = await db.select().from(tickets).orderBy(desc(tickets.createdAt));

  // Apply server-side filters (same as admin)
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

  // TAT filters
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

  // Get all users for role management
  const client = await clerkClient();
  const userList = await client.users.getUserList();

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

  const stats = {
    total: allTickets.length,
    open: allTickets.filter(t => t.status === 'open').length,
    closed: allTickets.filter(t => t.status === 'closed').length,
    inProgress: allTickets.filter(t => t.status && t.status !== 'open' && t.status !== 'closed').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-6">Super Admin Dashboard</h1>
        <Tabs defaultValue="tickets" value={activeTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="tickets" asChild>
              <Link href="/dashboard/superadmin">Tickets</Link>
            </TabsTrigger>
            <TabsTrigger value="users" asChild>
              <Link href="/dashboard/superadmin?tab=users">User Management</Link>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tickets" className="space-y-6">
            <AdminTicketFilters />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
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

            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">All Tickets (Super Admin View)</h2>
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

          <TabsContent value="users">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">User Management</h2>
              <UserManagement users={users} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

