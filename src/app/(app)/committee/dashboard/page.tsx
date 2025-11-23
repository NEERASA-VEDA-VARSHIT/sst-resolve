import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, tickets, ticket_committee_tags, committee_members, ticket_statuses, categories } from "@/db";
import { desc, eq, inArray } from "drizzle-orm";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { TicketCard } from "@/components/layout/TicketCard";
import TicketSearch from "@/components/student/TicketSearch";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Force dynamic rendering since we use auth headers
export const dynamic = "force-dynamic";

export default async function CommitteeDashboardPage({ 
  searchParams 
}: { 
  searchParams?: Promise<Record<string, string | string[] | undefined>>
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

  // Await searchParams (Next.js 15)
  const resolvedSearchParams = searchParams ? await searchParams : {};
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

  // Get tickets created by this committee member with joins
  const createdTicketRows = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      description: tickets.description,
      location: tickets.location,
      status_id: tickets.status_id,
      category_id: tickets.category_id,
      subcategory_id: tickets.subcategory_id,
      sub_subcategory_id: tickets.sub_subcategory_id,
      created_by: tickets.created_by,
      assigned_to: tickets.assigned_to,
      acknowledged_by: tickets.acknowledged_by,
      group_id: tickets.group_id,
      escalation_level: tickets.escalation_level,
      tat_extended_count: tickets.tat_extended_count,
      last_escalation_at: tickets.last_escalation_at,
      acknowledgement_tat_hours: tickets.acknowledgement_tat_hours,
      resolution_tat_hours: tickets.resolution_tat_hours,
      acknowledgement_due_at: tickets.acknowledgement_due_at,
      resolution_due_at: tickets.resolution_due_at,
      acknowledged_at: tickets.acknowledged_at,
      reopened_at: tickets.reopened_at,
      sla_breached_at: tickets.sla_breached_at,
      reopen_count: tickets.reopen_count,
      rating: tickets.rating,
      feedback_type: tickets.feedback_type,
      rating_submitted: tickets.rating_submitted,
      feedback: tickets.feedback,
      is_public: tickets.is_public,
      admin_link: tickets.admin_link,
      student_link: tickets.student_link,
      slack_thread_id: tickets.slack_thread_id,
      external_ref: tickets.external_ref,
      metadata: tickets.metadata,
      created_at: tickets.created_at,
      updated_at: tickets.updated_at,
      resolved_at: tickets.resolved_at,
      status_value: ticket_statuses.value,
      category_name: categories.name,
    })
    .from(tickets)
    .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
    .leftJoin(categories, eq(tickets.category_id, categories.id))
    .where(eq(tickets.created_by, user.id))
    .orderBy(desc(tickets.created_at));

  // Filter by category name = "Committee" and transform for TicketCard
  let createdTickets = createdTicketRows
    .filter(t => (t.category_name || "").toLowerCase() === "committee")
    .map(t => ({
      ...t,
      status: t.status_value || null,
      category_name: t.category_name || null,
    }));

  // Get tickets tagged to committees this user belongs to with joins
  type TicketWithExtras = typeof tickets.$inferSelect & {
    status?: string | null;
    status_value?: string | null;
    category_name?: string | null;
  };
  let taggedTickets: TicketWithExtras[] = [];
  if (committeeIds.length > 0) {
    const tagRecords = await db
      .select({ ticket_id: ticket_committee_tags.ticket_id })
      .from(ticket_committee_tags)
      .where(inArray(ticket_committee_tags.committee_id, committeeIds));

    const taggedTicketIds = tagRecords.map(t => t.ticket_id);
    
    if (taggedTicketIds.length > 0) {
      const taggedTicketRows = await db
        .select({
          id: tickets.id,
          title: tickets.title,
          description: tickets.description,
          location: tickets.location,
          status_id: tickets.status_id,
          category_id: tickets.category_id,
          subcategory_id: tickets.subcategory_id,
          sub_subcategory_id: tickets.sub_subcategory_id,
          created_by: tickets.created_by,
          assigned_to: tickets.assigned_to,
          acknowledged_by: tickets.acknowledged_by,
          group_id: tickets.group_id,
          escalation_level: tickets.escalation_level,
          tat_extended_count: tickets.tat_extended_count,
          last_escalation_at: tickets.last_escalation_at,
          acknowledgement_tat_hours: tickets.acknowledgement_tat_hours,
          resolution_tat_hours: tickets.resolution_tat_hours,
          acknowledgement_due_at: tickets.acknowledgement_due_at,
          resolution_due_at: tickets.resolution_due_at,
          acknowledged_at: tickets.acknowledged_at,
          reopened_at: tickets.reopened_at,
          sla_breached_at: tickets.sla_breached_at,
          reopen_count: tickets.reopen_count,
          rating: tickets.rating,
          feedback_type: tickets.feedback_type,
          rating_submitted: tickets.rating_submitted,
          feedback: tickets.feedback,
          is_public: tickets.is_public,
          admin_link: tickets.admin_link,
          student_link: tickets.student_link,
          slack_thread_id: tickets.slack_thread_id,
          external_ref: tickets.external_ref,
          metadata: tickets.metadata,
          created_at: tickets.created_at,
          updated_at: tickets.updated_at,
          resolved_at: tickets.resolved_at,
          status_value: ticket_statuses.value,
          category_name: categories.name,
        })
        .from(tickets)
        .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
        .leftJoin(categories, eq(tickets.category_id, categories.id))
        .where(inArray(tickets.id, taggedTicketIds))
        .orderBy(desc(tickets.created_at));
      
      taggedTickets = taggedTicketRows.map(t => ({
        ...t,
        status: t.status_value || null,
        category_name: t.category_name || null,
      }));
    }
  }

  // Apply filters to created tickets
  if (search) {
    const searchLower = search.toLowerCase();
    createdTickets = createdTickets.filter(t => 
      t.id.toString().includes(search) ||
      (t.description || "").toLowerCase().includes(searchLower) ||
      (t.category_name || "").toLowerCase().includes(searchLower)
    );
  }

  if (statusFilter) {
    const statusLower = statusFilter.toLowerCase();
    if (statusLower === "resolved") {
      createdTickets = createdTickets.filter(t => {
        const status = (t.status || "").toLowerCase();
        return status === "resolved" || status === "closed";
      });
    } else {
      createdTickets = createdTickets.filter(t => (t.status || "").toLowerCase() === statusLower);
    }
  }

  if (categoryFilter) {
    createdTickets = createdTickets.filter(t => (t.category_name || "").toLowerCase() === categoryFilter.toLowerCase());
  }

  // Apply filters to tagged tickets
  if (search) {
    const searchLower = search.toLowerCase();
    taggedTickets = taggedTickets.filter(t => 
      t.id.toString().includes(search) ||
      (t.description || "").toLowerCase().includes(searchLower) ||
      (t.category_name || "").toLowerCase().includes(searchLower)
    );
  }

  if (statusFilter) {
    const statusLower = statusFilter.toLowerCase();
    if (statusLower === "resolved") {
      taggedTickets = taggedTickets.filter(t => {
        const status = (t.status || "").toLowerCase();
        return status === "resolved" || status === "closed";
      });
    } else {
      taggedTickets = taggedTickets.filter(t => (t.status || "").toLowerCase() === statusLower);
    }
  }

  if (categoryFilter) {
    taggedTickets = taggedTickets.filter(t => (t.category_name || "").toLowerCase() === categoryFilter.toLowerCase());
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
              open: createdTickets.filter(t => (t.status || "").toLowerCase() === 'open').length,
              // Include both IN_PROGRESS and ESCALATED status as "in progress"
              inProgress: createdTickets.filter(t => {
                const status = (t.status || "").toLowerCase();
                return status === 'in_progress' || status === 'escalated';
              }).length,
              awaitingStudent: createdTickets.filter(t => (t.status || "").toLowerCase() === 'awaiting_student_response').length,
              resolved: createdTickets.filter(t => {
                const status = (t.status || "").toLowerCase();
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
              open: taggedTickets.filter(t => (t.status || "").toLowerCase() === 'open').length,
              // Include both IN_PROGRESS and ESCALATED status as "in progress"
              inProgress: taggedTickets.filter(t => {
                const status = (t.status || "").toLowerCase();
                return status === 'in_progress' || status === 'escalated';
              }).length,
              awaitingStudent: taggedTickets.filter(t => (t.status || "").toLowerCase() === 'awaiting_student_response').length,
              resolved: taggedTickets.filter(t => {
                const status = (t.status || "").toLowerCase();
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

