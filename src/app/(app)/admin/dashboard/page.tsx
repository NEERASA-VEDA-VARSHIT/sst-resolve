import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, tickets, users, staff, categories } from "@/db";
import { desc, eq, or, isNull, inArray } from "drizzle-orm";
import { TicketCard } from "@/components/layout/TicketCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { clerkClient } from "@clerk/nextjs/server";
import { AdminTicketFilters } from "@/components/admin/AdminTicketFilters";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { Button } from "@/components/ui/button";
import { FileText, Clock, CheckCircle2, AlertCircle, TrendingUp, Calendar, Users } from "lucide-react";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";
import { isAdminLevel } from "@/conf/constants";

export default async function AdminDashboardPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined> }) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  // Ensure user exists in database
  await getOrCreateUser(userId);

  // Get role from database (single source of truth)
  const role = await getUserRoleFromDB(userId);

  // Redirect super_admin to superadmin dashboard
  if (role === 'super_admin') {
    redirect('/superadmin/dashboard');
  }

  // Only allow admin-level roles (admin, committee, super_admin)
  if (!isAdminLevel(role)) {
    redirect('/student/dashboard');
  }

  // Get admin's staff record to find staff.id
  let adminStaffId: number | null = null;
  try {
    const dbUser = await getOrCreateUser(userId);

    if (!dbUser) {
      console.error('[Admin Dashboard] Failed to create/fetch user');
      throw new Error('Failed to load user profile');
    }

    const [staffMember] = await db
      .select({ id: staff.id })
      .from(staff)
      .where(eq(staff.user_id, dbUser.id))
      .limit(1);

    adminStaffId = staffMember?.id || null;
  } catch (error) {
    console.error('[Admin Dashboard] Error fetching user/staff info:', error);
    throw new Error('Failed to load admin profile');
  }

  // Await searchParams if it's a Promise (Next.js 15)
  const resolvedSearchParams = searchParams instanceof Promise ? await searchParams : (searchParams || {});
  const params = resolvedSearchParams || {};
  const activeTab = (typeof params["tab"] === "string" ? params["tab"] : params["tab"]?.[0]) || "tickets";
  const searchQuery = (typeof params["search"] === "string" ? params["search"] : params["search"]?.[0]) || "";
  const category = (typeof params["category"] === "string" ? params["category"] : params["category"]?.[0]) || "";
  const subcategory = (typeof params["subcategory"] === "string" ? params["subcategory"] : params["subcategory"]?.[0]) || "";
  const location = (typeof params["location"] === "string" ? params["location"] : params["location"]?.[0]) || "";
  const tat = (typeof params["tat"] === "string" ? params["tat"] : params["tat"]?.[0]) || "";
  const status = (typeof params["status"] === "string" ? params["status"] : params["status"]?.[0]) || "";
  const createdFrom = (typeof params["from"] === "string" ? params["from"] : params["from"]?.[0]) || "";
  const createdTo = (typeof params["to"] === "string" ? params["to"] : params["to"]?.[0]) || "";
  const user = (typeof params["user"] === "string" ? params["user"] : params["user"]?.[0]) || "";
  const sort = (typeof params["sort"] === "string" ? params["sort"] : params["sort"]?.[0]) || "newest";
  const escalated = (typeof params["escalated"] === "string" ? params["escalated"] : params["escalated"]?.[0]) || "";

  // Get admin's domain/scope assignment
    const { getAdminAssignment, ticketMatchesAdminAssignment } = await import("@/lib/admin-assignment");
    const adminAssignment = await getAdminAssignment(userId);
    const hasAssignment = !!adminAssignment.domain;

    // Fetch all tickets first
    let allTickets = await db
      .select()
      .from(tickets)
      .orderBy(desc(tickets.created_at));

    // Get category names for all tickets (batch query for performance)
    const categoryIds = [...new Set(allTickets.map(t => t.category_id).filter(Boolean) as number[])];
    const categoryMap = new Map<number, string>();
    if (categoryIds.length > 0) {
      const categoryRecords = await db
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .where(inArray(categories.id, categoryIds));
      for (const cat of categoryRecords) {
        categoryMap.set(cat.id, cat.name);
      }
    }

    // Filter by assignment (now synchronous since we have categoryMap)
    if (adminStaffId) {
      allTickets = allTickets.filter(t => {
        // Show tickets assigned to this admin
        if (t.assigned_to === adminStaffId) {
          if (hasAssignment) {
            // If admin has domain assignment, check if ticket matches
            const ticketCategory = t.category_id 
              ? categoryMap.get(t.category_id) || null
              : t.category; // Fallback to legacy category field
            return ticketMatchesAdminAssignment(
              { category: ticketCategory, location: t.location },
              adminAssignment
            );
          }
          return true;
        }
        // Show unassigned tickets that match admin's domain/scope
        if (!t.assigned_to && hasAssignment) {
          const ticketCategory = t.category_id 
            ? categoryMap.get(t.category_id) || null
            : t.category;
          return ticketMatchesAdminAssignment(
            { category: ticketCategory, location: t.location },
            adminAssignment
          );
        }
        return false;
      });
    } else {
      // If not a staff member, show no tickets (committee members might not have staff record)
      allTickets = [];
    }

    // Search filter (searches across ID, description, user info, and subcategory)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      allTickets = allTickets.filter(t => {
        const idMatch = t.id.toString().includes(query);
        const descMatch = (t.description || "").toLowerCase().includes(query);
        // Get user info for search
        const userMatch = false; // Will be populated if needed from users table
        // Get subcategory from metadata
        const metadata = (t.metadata as any) || {};
        const subcatName = metadata.subcategory || t.subcategory || "";
        const subcatMatch = subcatName.toLowerCase().includes(query);
        return idMatch || descMatch || subcatMatch;
      });
    }

    if (category) {
      allTickets = allTickets.filter(t => {
        const ticketCategory = t.category_id ? categoryMap.get(t.category_id) : t.category;
        return (ticketCategory || "").toLowerCase() === category.toLowerCase();
      });
    }
    if (subcategory) {
      allTickets = allTickets.filter(t => {
        const metadata = (t.metadata as any) || {};
        const subcatName = metadata.subcategory || t.subcategory || "";
        return subcatName.toLowerCase().includes(subcategory.toLowerCase());
      });
    }
    if (location) {
      allTickets = allTickets.filter(t => (t.location || "").toLowerCase().includes(location.toLowerCase()));
    }
    if (status) {
      if (status.toLowerCase() === "resolved") {
        allTickets = allTickets.filter(t => t.status === "RESOLVED" || t.status === "CLOSED");
      } else {
        allTickets = allTickets.filter(t => (t.status || "").toLowerCase() === status.toLowerCase());
      }
    }
    if (escalated === "true") {
      allTickets = allTickets.filter(t => (t.escalation_level || 0) > 0);
    }
    if (user) {
      // Search by user - would need to join with users table for full search
      // For now, filter by user_number (legacy) or skip
      allTickets = allTickets.filter(t => {
        const userNumber = t.user_number || "";
        return userNumber.toLowerCase().includes(user.toLowerCase());
      });
    }
    if (createdFrom) {
      const from = new Date(createdFrom);
      from.setHours(0,0,0,0);
      allTickets = allTickets.filter(t => t.created_at ? new Date(t.created_at).getTime() >= from.getTime() : false);
    }
    if (createdTo) {
      const to = new Date(createdTo);
      to.setHours(23,59,59,999);
      allTickets = allTickets.filter(t => t.created_at ? new Date(t.created_at).getTime() <= to.getTime() : false);
    }

    if (tat) {
      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);
      allTickets = allTickets.filter(t => {
        // Use authoritative due_at field first, fallback to metadata.tatDate
        const dueDate = t.due_at ? new Date(t.due_at) : null;
        const metadata = (t.metadata as any) || {};
        const metadataTatDate = metadata.tatDate ? new Date(metadata.tatDate) : null;
        const tatDate = dueDate || metadataTatDate;
        const hasTat = !!tatDate;
        
        if (tat === "has") return hasTat;
        if (tat === "none") return !hasTat;
        if (tat === "due") return hasTat && tatDate && tatDate.getTime() < now.getTime();
        if (tat === "upcoming") return hasTat && tatDate && tatDate.getTime() >= now.getTime();
        if (tat === "today") {
          return hasTat && tatDate && tatDate.getTime() >= startOfToday.getTime() && tatDate.getTime() <= endOfToday.getTime();
        }
        return true;
      });
    }

  if (sort === "oldest") {
    allTickets = [...allTickets].reverse();
  }

  const client = await clerkClient();
  const userList = await client.users.getUserList();
  const clerkUsers = userList.data.map(user => ({
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
      open: allTickets.filter(t => t.status === 'OPEN').length,
      inProgress: allTickets.filter(t => t.status === 'IN_PROGRESS').length,
      resolved: allTickets.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED').length,
      escalated: allTickets.filter(t => (t.escalation_level || 0) > 0).length,
    };

    // Calculate today pending count
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const todayPending = allTickets.filter(t => {
      const status = (t.status || "").toUpperCase();
      if (!["OPEN", "IN_PROGRESS", "AWAITING_STUDENT", "REOPENED"].includes(status)) return false;
      // Use authoritative due_at field first, fallback to metadata.tatDate
      const dueDate = t.due_at ? new Date(t.due_at) : null;
      const metadata = (t.metadata as any) || {};
      const metadataTatDate = metadata.tatDate ? new Date(metadata.tatDate) : null;
      const tatDate = dueDate || metadataTatDate;
      if (!tatDate || isNaN(tatDate.getTime())) return false;
      return tatDate.getTime() >= startOfToday.getTime() && tatDate.getTime() <= endOfToday.getTime();
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
          <div className="flex gap-2 flex-wrap">
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

