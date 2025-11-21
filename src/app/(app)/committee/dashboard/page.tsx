import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, tickets, ticket_committee_tags, committee_members, users } from "@/db";
import { desc, eq, inArray } from "drizzle-orm";
import { getOrCreateUser } from "@/lib/user-sync";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { TicketCard } from "@/components/layout/TicketCard";
import { TicketSearch } from "@/components/student/TicketSearch";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { enumToStatus } from "@/lib/status-helpers";

export default async function CommitteeDashboardPage({ 
  searchParams 
}: { 
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  // Ensure user exists in database
  await getOrCreateUser(userId);

  // Get role from database (single source of truth)
  const role = await getUserRoleFromDB(userId);
  
  if (role !== "committee") {
    redirect("/student/dashboard");
  }

  // Await searchParams if it's a Promise (Next.js 15)
  const resolvedSearchParams = searchParams instanceof Promise ? await searchParams : (searchParams || {});
  const params = resolvedSearchParams || {};
  const search = (typeof params["search"] === "string" ? params["search"] : params["search"]?.[0]) || "";
  const statusFilter = (typeof params["status"] === "string" ? params["status"] : params["status"]?.[0]) || "";
  const categoryFilter = (typeof params["category"] === "string" ? params["category"] : params["category"]?.[0]) || "";
  const tab = (typeof params["tab"] === "string" ? params["tab"] : params["tab"]?.[0]) || "created";

  // Ensure user exists and get user_id
  const user = await getOrCreateUser(userId);
  
  if (!user) {
    console.error('[Committee Dashboard] Failed to create/fetch user');
    throw new Error('Failed to load user profile');
  }

  // Get committee IDs this user belongs to (using user_id FK)
  const memberRecords = await db
    .select({ committee_id: committee_members.committee_id })
    .from(committee_members)
    .where(eq(committee_members.user_id, user.id));

  const committeeIds = memberRecords.map(m => m.committee_id);

  // Get tickets created by this committee member
  let createdTickets = await db
    .select()
    .from(tickets)
    .where(eq(tickets.user_number, userId))
    .orderBy(desc(tickets.created_at));

  // Filter by category = "Committee"
  createdTickets = createdTickets.filter(t => t.category === "Committee");

  // Get tickets tagged to committees this user belongs to
  let taggedTickets: typeof tickets.$inferSelect[] = [];
  if (committeeIds.length > 0) {
    const tagRecords = await db
      .select({ ticket_id: ticket_committee_tags.ticket_id })
      .from(ticket_committee_tags)
      .where(inArray(ticket_committee_tags.committee_id, committeeIds));

    const taggedTicketIds = tagRecords.map(t => t.ticket_id);
    
    if (taggedTicketIds.length > 0) {
      taggedTickets = await db
        .select()
        .from(tickets)
        .where(inArray(tickets.id, taggedTicketIds))
        .orderBy(desc(tickets.created_at));
    }
  }

  // Apply filters to created tickets
  if (search) {
    const searchLower = search.toLowerCase();
    createdTickets = createdTickets.filter(t => 
      t.id.toString().includes(search) ||
      (t.description || "").toLowerCase().includes(searchLower) ||
      (t.subcategory || "").toLowerCase().includes(searchLower)
    );
  }

  if (statusFilter) {
    if (statusFilter.toLowerCase() === "resolved") {
      createdTickets = createdTickets.filter(t => {
        const status = enumToStatus(t.status);
        return status === "resolved" || status === "closed";
      });
    } else {
      createdTickets = createdTickets.filter(t => enumToStatus(t.status).toLowerCase() === statusFilter.toLowerCase());
    }
  }

  if (categoryFilter) {
    createdTickets = createdTickets.filter(t => (t.category || "").toLowerCase() === categoryFilter.toLowerCase());
  }

  // Apply filters to tagged tickets
  if (search) {
    const searchLower = search.toLowerCase();
    taggedTickets = taggedTickets.filter(t => 
      t.id.toString().includes(search) ||
      (t.description || "").toLowerCase().includes(searchLower) ||
      (t.subcategory || "").toLowerCase().includes(searchLower)
    );
  }

  if (statusFilter) {
    if (statusFilter.toLowerCase() === "resolved") {
      taggedTickets = taggedTickets.filter(t => {
        const status = enumToStatus(t.status);
        return status === "resolved" || status === "closed";
      });
    } else {
      taggedTickets = taggedTickets.filter(t => enumToStatus(t.status).toLowerCase() === statusFilter.toLowerCase());
    }
  }

  if (categoryFilter) {
    taggedTickets = taggedTickets.filter(t => (t.category || "").toLowerCase() === categoryFilter.toLowerCase());
  }

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Committee Dashboard
          </h1>
          <p className="text-muted-foreground">
            Manage tickets created by you and tickets tagged to your committee
          </p>
        </div>
        <Button asChild>
          <Link href="/committee/dashboard/ticket/new">
            <Plus className="w-4 h-4 mr-2" />
            New Ticket
          </Link>
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={tab} className="w-full">
        <TabsList>
          <TabsTrigger value="created" asChild>
            <Link href="/committee/dashboard?tab=created">My Created Tickets</Link>
          </TabsTrigger>
          <TabsTrigger value="tagged" asChild>
            <Link href="/committee/dashboard?tab=tagged">
              <Users className="w-4 h-4 mr-2" />
              Tagged to My Committee ({taggedTickets.length})
            </Link>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="created" className="space-y-6">
          {/* Stats Cards */}
          {createdTickets.length > 0 && (
            <StatsCards stats={{
              total: createdTickets.length,
              open: createdTickets.filter(t => enumToStatus(t.status) === 'open').length,
              // Include both IN_PROGRESS and ESCALATED status as "in progress"
              inProgress: createdTickets.filter(t => {
                const status = enumToStatus(t.status);
                return status === 'in_progress' || status === 'escalated';
              }).length,
              awaitingStudent: createdTickets.filter(t => enumToStatus(t.status) === 'awaiting_student_response').length,
              resolved: createdTickets.filter(t => {
                const status = enumToStatus(t.status);
                return status === 'resolved' || status === 'closed';
              }).length,
              escalated: createdTickets.filter(t => (Number(t.escalation_level) || 0) > 0).length,
            }} />
          )}

          {/* Search and Filters */}
          <TicketSearch />

          {/* Tickets List */}
          {createdTickets.length === 0 ? (
            <Card className="border-2 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Plus className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-lg font-semibold mb-1">No tickets found</p>
                <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
                  {search || statusFilter || categoryFilter
                    ? "Try adjusting your search or filters"
                    : "Create your first committee ticket to get started"}
                </p>
                {!search && !statusFilter && !categoryFilter && (
                  <Button asChild>
                    <Link href="/committee/dashboard/ticket/new">
                      <Plus className="w-4 h-4 mr-2" />
                      Create New Ticket
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {createdTickets.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} basePath="/committee/dashboard" />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tagged" className="space-y-6">
          {/* Stats Cards */}
          {taggedTickets.length > 0 && (
            <StatsCards stats={{
              total: taggedTickets.length,
              open: taggedTickets.filter(t => enumToStatus(t.status) === 'open').length,
              // Include both IN_PROGRESS and ESCALATED status as "in progress"
              inProgress: taggedTickets.filter(t => {
                const status = enumToStatus(t.status);
                return status === 'in_progress' || status === 'escalated';
              }).length,
              awaitingStudent: taggedTickets.filter(t => enumToStatus(t.status) === 'awaiting_student_response').length,
              resolved: taggedTickets.filter(t => {
                const status = enumToStatus(t.status);
                return status === 'resolved' || status === 'closed';
              }).length,
              escalated: taggedTickets.filter(t => (Number(t.escalation_level) || 0) > 0).length,
            }} />
          )}

          {/* Search and Filters */}
          <TicketSearch />

          {/* Tagged Tickets List */}
          {(search || statusFilter || categoryFilter ? taggedTickets.length === 0 : false) ? (
            <Card className="border-2 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <p className="text-sm text-muted-foreground text-center">
                  No tickets match your filters
                </p>
              </CardContent>
            </Card>
          ) : taggedTickets.length === 0 ? (
            <Card className="border-2 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-lg font-semibold mb-1">No tagged tickets</p>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  Tickets tagged to your committee by admins will appear here. You can step in and resolve these tickets.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {taggedTickets.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} basePath="/committee/dashboard" />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

