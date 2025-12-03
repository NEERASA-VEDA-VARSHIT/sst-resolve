import { db, tickets, categories, ticket_statuses, ticket_groups, users } from "@/db";
import { desc, eq, isNotNull, and, sql, ilike } from "drizzle-orm";
import { aliasedTable } from "drizzle-orm";
import { TicketGrouping } from "@/components/admin/TicketGrouping";
import { SelectableTicketList } from "@/components/admin/SelectableTicketList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowLeft, Users, Package, CheckCircle2, TrendingUp } from "lucide-react";
import { AdminTicketFilters } from "@/components/admin/AdminTicketFilters";
import type { Ticket } from "@/db/types-only";
import type { TicketMetadata } from "@/db/inferred-types";

// Force dynamic rendering since we use auth headers
export const dynamic = "force-dynamic";
// Cache response for 30 seconds to improve performance
export const revalidate = 30;

/**
 * Super Admin Groups Page
 * Note: Auth and role checks are handled by superadmin/layout.tsx
 */
export default async function SuperAdminGroupsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {

  // Parse search params
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const params = resolvedSearchParams || {};
  const statusFilter = (typeof params["status"] === "string" ? params["status"] : params["status"]?.[0]) || "";
  const categoryFilter = (typeof params["category"] === "string" ? params["category"] : params["category"]?.[0]) || "";
  const searchQuery = (typeof params["search"] === "string" ? params["search"] : params["search"]?.[0]) || "";
  const locationFilter = (typeof params["location"] === "string" ? params["location"] : params["location"]?.[0]) || "";

  // Build where conditions
  const conditions = [];

  // Status filter
  if (statusFilter) {
    const normalizedStatus = statusFilter.toLowerCase();
    if (normalizedStatus === "escalated") {
      conditions.push(sql`${tickets.escalation_level} > 0`);
    } else {
      conditions.push(sql`LOWER(${ticket_statuses.value}) = ${normalizedStatus}`);
    }
  }

  // Category filter
  if (categoryFilter) {
    conditions.push(ilike(categories.name, `%${categoryFilter}%`));
  }

  // Location filter
  if (locationFilter) {
    conditions.push(ilike(tickets.location, `%${locationFilter}%`));
  }

  // Search query filter
  if (searchQuery) {
    conditions.push(
      sql`(
        ${tickets.id}::text ILIKE ${`%${searchQuery}%`} OR
        ${tickets.description} ILIKE ${`%${searchQuery}%`} OR
        ${tickets.title} ILIKE ${`%${searchQuery}%`}
      )`
    );
  }

  // Fetch all tickets for super admin with proper joins
  const creatorUser = aliasedTable(users, "creator");
  
  const allTicketRows = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      description: tickets.description,
      location: tickets.location,
      status_id: tickets.status_id,
      status_value: ticket_statuses.value,
      category_id: tickets.category_id,
      category_name: categories.name,
      subcategory_id: tickets.subcategory_id,
      sub_subcategory_id: tickets.sub_subcategory_id,
      created_by: tickets.created_by,
      creator_full_name: creatorUser.full_name,
      creator_email: creatorUser.email,
      assigned_to: tickets.assigned_to,
      group_id: tickets.group_id,
      escalation_level: tickets.escalation_level,
      acknowledgement_due_at: tickets.acknowledgement_due_at,
      resolution_due_at: tickets.resolution_due_at,
      metadata: tickets.metadata,
      created_at: tickets.created_at,
      updated_at: tickets.updated_at,
    })
    .from(tickets)
    .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
    .leftJoin(categories, eq(tickets.category_id, categories.id))
    .leftJoin(creatorUser, eq(tickets.created_by, creatorUser.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(tickets.created_at))
    .limit(500); // Reduced limit for better performance - can paginate if needed

  // Grouping stats based purely on data, not placeholders
  const totalTicketsCount = allTicketRows.length;

  // Tickets that are in any group
  const groupedTicketIds = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(isNotNull(tickets.group_id));

  const groupedTicketIdSet = new Set(groupedTicketIds.map(t => t.id));
  const groupedTicketsCount = groupedTicketIdSet.size;

  // Tickets not in any group
  const availableTicketsCount = totalTicketsCount - groupedTicketsCount;

  // Group stats
  const allGroups = await db
    .select()
    .from(ticket_groups);

  const activeGroupsCount = allGroups.filter(g => !g.is_archived).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Ticket Groups
          </h1>
          <p className="text-muted-foreground">
            Select tickets and group them together for bulk operations (comment, close, etc.)
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/superadmin/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
      </div>


      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-2 hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Tickets</p>
                <p className="text-2xl font-bold mt-1">{totalTicketsCount}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Package className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Available</p>
                <p className="text-2xl font-bold mt-1">{availableTicketsCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Not in any group</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Groups</p>
                <p className="text-2xl font-bold mt-1">{activeGroupsCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Non-archived groups</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Grouped Tickets</p>
                <p className="text-2xl font-bold mt-1">{groupedTicketsCount}</p>
                <p className="text-xs text-muted-foreground mt-1">In groups</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Existing Groups */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Existing Groups
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TicketGrouping selectedTicketIds={[]} />
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminTicketFilters />
        </CardContent>
      </Card>
      
      {/* Select Tickets to Group */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle>Select Tickets to Group</CardTitle>
            <Badge variant="secondary" className="text-sm w-fit">
              {allTicketRows.length} {allTicketRows.length === 1 ? "ticket" : "tickets"} available
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {allTicketRows.length === 0 ? (
            <div className="py-12 text-center">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground font-medium">No tickets available for grouping</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create tickets first to start grouping them
              </p>
            </div>
          ) : (
            <SelectableTicketList
              tickets={allTicketRows.map(t => {
                let ticketMetadata: TicketMetadata = {};
                if (t.metadata && typeof t.metadata === 'object' && !Array.isArray(t.metadata)) {
                  ticketMetadata = t.metadata as TicketMetadata;
                }
                return {
                  ...t,
                  status: t.status_value || null,
                  status_id: t.status_id || null,
                  scope_id: null,
                  resolved_at: ticketMetadata.resolved_at ? new Date(ticketMetadata.resolved_at) : null,
                  reopened_at: ticketMetadata.reopened_at ? new Date(ticketMetadata.reopened_at) : null,
                  acknowledged_at: ticketMetadata.acknowledged_at ? new Date(ticketMetadata.acknowledged_at) : null,
                  rating: ticketMetadata.rating as number | null || null,
                  feedback: ticketMetadata.feedback as string | null || null,
                  category_name: t.category_name || null,
                  creator_name: t.creator_full_name || null,
                  creator_email: t.creator_email || null,
                };
              }) as unknown as Ticket[]}
              basePath="/superadmin/dashboard"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

