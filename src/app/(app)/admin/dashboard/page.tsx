import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, tickets, users, categories, ticket_statuses, domains } from "@/db";
import { desc, eq, or, isNull, inArray, aliasedTable } from "drizzle-orm";
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

export default async function AdminDashboardPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
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

  // Get admin's user ID for ticket assignment
  let adminUserId: string | null = null;
  try {
    const dbUser = await getOrCreateUser(userId);

    if (!dbUser) {
      console.error('[Admin Dashboard] Failed to create/fetch user');
      throw new Error('Failed to load user profile');
    }

    adminUserId = dbUser.id;
  } catch (error) {
    console.error('[Admin Dashboard] Error fetching user info:', error);
    throw new Error('Failed to load admin profile');
  }

  // Await searchParams (Next.js 15)
  const resolvedSearchParams = searchParams ? await searchParams : {};
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

  // Fetch all tickets with joins for status and category
  const ticketRows = await db
    .select({
      // Ticket fields
      id: tickets.id,
      status_id: tickets.status_id,
      status_value: ticket_statuses.value,
      status_label: ticket_statuses.label,
      status_badge_color: ticket_statuses.badge_color,
      category_id: tickets.category_id,
      category_name: categories.name,
      description: tickets.description,
      location: tickets.location,
      assigned_to: tickets.assigned_to,
      escalation_level: tickets.escalation_level,
      metadata: tickets.metadata,
      created_at: tickets.created_at,
      updated_at: tickets.updated_at,
      resolution_due_at: tickets.resolution_due_at,
      // Creator fields
      creator_id: users.id,
      creator_first_name: users.first_name,
      creator_last_name: users.last_name,
      creator_email: users.email,
    })
    .from(tickets)
    .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
    .leftJoin(categories, eq(tickets.category_id, categories.id))
    .leftJoin(users, eq(tickets.created_by, users.id))
    .orderBy(desc(tickets.created_at));

  // Transform to match TicketCard expected format
  // We need to fetch the full ticket data to satisfy TicketCard type requirements
  const ticketIds = ticketRows.map(t => t.id);
  let allTickets: any[] = [];
  
  if (ticketIds.length > 0) {
    const fullTicketRows = await db
      .select()
      .from(tickets)
      .where(inArray(tickets.id, ticketIds));
    
    // Create a map of full tickets by ID
    const fullTicketMap = new Map(fullTicketRows.map(t => [t.id, t]));
    
    // Merge the full ticket data with the joined data
    allTickets = ticketRows.map(ticket => {
      const fullTicket = fullTicketMap.get(ticket.id);
      return {
        ...fullTicket, // This includes all required Ticket fields
        // Override with joined data
        status_id: ticket.status_id,
        status_value: ticket.status_value,
        status_label: ticket.status_label,
        status_badge_color: ticket.status_badge_color,
        category_name: ticket.category_name,
        creator_first_name: ticket.creator_first_name,
        creator_last_name: ticket.creator_last_name,
        creator_email: ticket.creator_email,
        // Additional fields for TicketCard
        status: ticket.status_value || null,
        creator_name: [ticket.creator_first_name, ticket.creator_last_name].filter(Boolean).join(' ').trim() || null,
        due_at: ticket.resolution_due_at,
      };
    });
  }

  // Get category names and domains for all tickets (for filtering logic)
  const categoryMap = new Map<number, { name: string; domain: string | null }>();
  const categoryIds = [...new Set(allTickets.map(t => t.category_id).filter(Boolean) as number[])];
  if (categoryIds.length > 0) {
    const categoryRecords = await db
      .select({ 
        id: categories.id, 
        name: categories.name,
        domainName: domains.name,
      })
      .from(categories)
      .leftJoin(domains, eq(categories.domain_id, domains.id))
      .where(inArray(categories.id, categoryIds));
    for (const cat of categoryRecords) {
      categoryMap.set(cat.id, { name: cat.name, domain: cat.domainName || null });
    }
  }

  // Get domains from categories this admin is assigned to
  const { getAdminAssignedCategoryDomains } = await import("@/lib/admin-assignment");
  const assignedCategoryDomains = adminUserId 
    ? await getAdminAssignedCategoryDomains(adminUserId)
    : [];

  // Filter by assignment (synchronous since we have categoryMap)
  if (adminUserId) {
    allTickets = allTickets.filter(t => {
      // Priority 1: Show tickets explicitly assigned to this admin (regardless of domain/scope)
      // This includes tickets assigned via category_assignments, default_admin_id, etc.
      if (t.assigned_to === adminUserId) {
        // If admin has a scope, filter by scope for assigned tickets too
        if (adminAssignment.scope && t.location) {
          const ticketLocation = (t.location || "").toLowerCase();
          const assignmentScope = (adminAssignment.scope || "").toLowerCase();
          return ticketLocation === assignmentScope;
        }
        return true; // Always show tickets assigned to this admin (if no scope restriction)
      }
      
      // Priority 2: Show tickets in domains from categories admin is assigned to
      // If admin is assigned to a category, they should see all tickets in that category's domain
      const ticketCategoryInfo = t.category_id ? categoryMap.get(t.category_id) : null;
      if (ticketCategoryInfo?.domain && assignedCategoryDomains.includes(ticketCategoryInfo.domain)) {
        // Admin is assigned to this category's domain
        // If admin has a scope, filter by scope
        if (adminAssignment.scope && t.location) {
          const ticketLocation = (t.location || "").toLowerCase();
          const assignmentScope = (adminAssignment.scope || "").toLowerCase();
          return ticketLocation === assignmentScope;
        }
        // No scope restriction, show all tickets in this domain
        return true;
      }
      
      // Priority 3: Show unassigned tickets that match admin's domain/scope (from primary assignment)
      // This allows admins to pick up unassigned tickets in their domain
      if (!t.assigned_to && hasAssignment) {
        const ticketCategory = ticketCategoryInfo?.name || null;
        return ticketMatchesAdminAssignment(
          { category: ticketCategory, location: t.location },
          adminAssignment
        );
      }
      
      return false;
    });
  } else {
    // If user ID not found, show no tickets
    allTickets = [];
  }

  // Search filter (searches across ID, description, and subcategory)
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    allTickets = allTickets.filter(t => {
      const idMatch = t.id.toString().includes(query);
      const descMatch = (t.description || "").toLowerCase().includes(query);
      // Get subcategory from metadata
      const metadata = (t.metadata as any) || {};
      const subcatName = metadata.subcategory || "";
      const subcatMatch = subcatName.toLowerCase().includes(query);
      return idMatch || descMatch || subcatMatch;
    });
  }

  // Category filter
  if (category) {
    allTickets = allTickets.filter(t => {
      const ticketCategory = t.category_id ? categoryMap.get(t.category_id) : null;
      const categoryName = ticketCategory?.name || t.category_name || "";
      return categoryName.toLowerCase() === category.toLowerCase();
    });
  }

  // Subcategory filter
  if (subcategory) {
    allTickets = allTickets.filter(t => {
      const metadata = (t.metadata as any) || {};
      const subcatName = metadata.subcategory || "";
      return subcatName.toLowerCase().includes(subcategory.toLowerCase());
    });
  }

  // Location filter
  if (location) {
    allTickets = allTickets.filter(t => (t.location || "").toLowerCase().includes(location.toLowerCase()));
  }

  // Status filter (using status_value from joined table)
  if (status) {
    const normalizedStatus = status.toUpperCase();
    allTickets = allTickets.filter(t => {
      const ticketStatus = t.status?.toUpperCase() || "";
      if (normalizedStatus === "RESOLVED") {
        return ticketStatus === "RESOLVED";
      } else if (normalizedStatus === "OPEN") {
        return ticketStatus === "OPEN";
      } else if (normalizedStatus === "IN_PROGRESS" || normalizedStatus === "IN PROGRESS") {
        return ticketStatus === "IN_PROGRESS";
      } else if (normalizedStatus === "AWAITING_STUDENT" || normalizedStatus === "AWAITING STUDENT" || normalizedStatus === "AWAITING_STUDENT_RESPONSE") {
        return ticketStatus === "AWAITING_STUDENT_RESPONSE" || ticketStatus === "AWAITING_STUDENT";
      } else if (normalizedStatus === "REOPENED") {
        return ticketStatus === "REOPENED";
      } else if (normalizedStatus === "ESCALATED") {
        return ticketStatus === "ESCALATED" || (t.escalation_level || 0) > 0;
      }
      return ticketStatus === normalizedStatus;
    });
  }

  // Escalated filter
  if (escalated === "true") {
    allTickets = allTickets.filter(t => (t.escalation_level || 0) > 0);
  }

  // User filter
  if (user) {
    allTickets = allTickets.filter(t => {
      const metadata = (t.metadata as any) || {};
      const userInfo = metadata.userEmail || metadata.userName || "";
      return userInfo.toLowerCase().includes(user.toLowerCase());
    });
  }

  // Date range filters
  if (createdFrom) {
    const from = new Date(createdFrom);
    from.setHours(0, 0, 0, 0);
    allTickets = allTickets.filter(t => t.created_at ? new Date(t.created_at).getTime() >= from.getTime() : false);
  }
  if (createdTo) {
    const to = new Date(createdTo);
    to.setHours(23, 59, 59, 999);
    allTickets = allTickets.filter(t => t.created_at ? new Date(t.created_at).getTime() <= to.getTime() : false);
  }

  // TAT filter
  if (tat) {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    allTickets = allTickets.filter(t => {
      // Use metadata.tatDate for TAT filtering
      const metadata = (t.metadata as any) || {};
      const metadataTatDate = metadata.tatDate ? new Date(metadata.tatDate) : null;
      const tatDate = metadataTatDate;
      const hasTat = !!tatDate && !isNaN(tatDate.getTime());

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

  // Sort
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
    open: allTickets.filter(t => (t.status?.toUpperCase() || "") === "OPEN").length,
    inProgress: allTickets.filter(t => (t.status?.toUpperCase() || "") === "IN_PROGRESS").length,
    resolved: allTickets.filter(t => (t.status?.toUpperCase() || "") === "RESOLVED").length,
    awaitingStudent: allTickets.filter(t => {
      const s = (t.status?.toUpperCase() || "");
      return s === "AWAITING_STUDENT_RESPONSE" || s === "AWAITING_STUDENT";
    }).length,
    escalated: allTickets.filter(t => (t.escalation_level || 0) > 0).length,
  };

  // Calculate today pending count
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const todayPending = allTickets.filter(t => {
    const isNotResolved = (t.status?.toUpperCase() || "") !== "RESOLVED";
    if (!isNotResolved) return false;
    // Use metadata.tatDate for TAT
    const metadata = (t.metadata as any) || {};
    const metadataTatDate = metadata.tatDate ? new Date(metadata.tatDate) : null;
    const tatDate = metadataTatDate;
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
