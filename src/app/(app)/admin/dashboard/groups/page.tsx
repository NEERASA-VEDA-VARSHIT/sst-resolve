import { auth } from "@clerk/nextjs/server";
import { db, tickets, categories, ticket_statuses, ticket_groups } from "@/db";
import { desc, eq, isNotNull, and, sql, ilike } from "drizzle-orm";
import { TicketGrouping } from "@/components/admin/TicketGrouping";
import { SelectableTicketList } from "@/components/admin/SelectableTicketList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowLeft, Users, Package, CheckCircle2, TrendingUp } from "lucide-react";
import { getCachedAdminUser, getCachedAdminAssignment } from "@/lib/cache/cached-queries";
import { ticketMatchesAdminAssignment } from "@/lib/assignment/admin-assignment";
import { AdminTicketFilters } from "@/components/admin/AdminTicketFilters";
import type { Ticket } from "@/db/types-only";
import type { AdminTicketRow } from "@/lib/ticket/adminTicketFilters";
import { applySubcategoryFilter, applyTATFilter } from "@/lib/ticket/adminTicketFilters";

// Force dynamic rendering since we use auth headers
export const dynamic = "force-dynamic";

export default async function AdminGroupsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  try {
    // Note: Auth and role checks are handled by admin/layout.tsx
    // Layout ensures userId exists and user is an admin, so we can safely use non-null assertion
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized"); // TypeScript type guard - layout ensures this never happens

    // Use cached functions for better performance
    // Layout already ensures user exists via getOrCreateUser, so dbUser will exist
    const { dbUser } = await getCachedAdminUser(userId);

    // Get admin's domain/scope assignment (cached)
    const adminAssignment = await getCachedAdminAssignment(userId);

    // Parse search params
    const resolvedSearchParams = searchParams ? await searchParams : {};
    const params = resolvedSearchParams || {};
    const statusFilter = (typeof params["status"] === "string" ? params["status"] : params["status"]?.[0]) || "";
    const categoryFilter = (typeof params["category"] === "string" ? params["category"] : params["category"]?.[0]) || "";
    const subcategoryFilter = (typeof params["subcategory"] === "string" ? params["subcategory"] : params["subcategory"]?.[0]) || "";
    const searchQuery = (typeof params["search"] === "string" ? params["search"] : params["search"]?.[0]) || "";
    const locationFilter = (typeof params["location"] === "string" ? params["location"] : params["location"]?.[0]) || "";
    const tatFilter = (typeof params["tat"] === "string" ? params["tat"] : params["tat"]?.[0]) || "";

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

    // Category filter - match by slug or name
    if (categoryFilter) {
      conditions.push(
        and(
          // Ensure category is present
          isNotNull(tickets.category_id),
          // Match either category slug or name (case-insensitive)
          sql`(${categories.slug} ILIKE ${`%${categoryFilter}%`} OR ${categories.name} ILIKE ${`%${categoryFilter}%`})`
        )
      );
    }

    // Location filter
    if (locationFilter) {
      conditions.push(ilike(tickets.location, `%${locationFilter}%`));
    }

    // Note: subcategory and TAT filters are applied after fetching using shared helpers

    // Search query filter
    if (searchQuery) {
      conditions.push(
        sql`(
          ${tickets.id}::text ILIKE ${`%${searchQuery}%`} OR
          ${tickets.description} ILIKE ${`%${searchQuery}%`}
        )`
      );
    }

    // Note: We don't filter by assigned_to here because we want to show:
    // 1. Tickets explicitly assigned to this admin
    // 2. Unassigned tickets matching admin's domain/scope (for grouping)
    // The in-memory filtering below handles domain/scope matching

    // Fetch tickets with proper joins for better data
    const allTicketRows = await db
      .select({
        id: tickets.id,
        title: tickets.title,
        description: tickets.description,
        location: tickets.location,
        status_id: tickets.status_id,
        status_value: ticket_statuses.value,
        category_id: tickets.category_id,
        subcategory_id: tickets.subcategory_id,
        created_by: tickets.created_by,
        assigned_to: tickets.assigned_to,
        group_id: tickets.group_id,
        escalation_level: tickets.escalation_level,
        acknowledgement_due_at: tickets.acknowledgement_due_at,
        resolution_due_at: tickets.resolution_due_at,
        metadata: tickets.metadata,
        created_at: tickets.created_at,
        updated_at: tickets.updated_at,
        category_name: categories.name,
      })
      .from(tickets)
      .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
      .leftJoin(categories, eq(tickets.category_id, categories.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(tickets.created_at))
      .limit(1000); // Reasonable limit for grouping operations

    // Filter tickets based on admin assignment
    // Show tickets that are:
    // 1. Explicitly assigned to this admin, OR
    // 2. Unassigned tickets matching admin's domain/scope
    let allTickets: AdminTicketRow[] = allTicketRows.filter(ticket => {
      // Priority 1: Tickets explicitly assigned to this admin
      if (ticket.assigned_to === dbUser.id) {
        // If admin has a scope, filter by scope for assigned tickets too
        if (adminAssignment.scope && ticket.location) {
          const ticketLocation = (ticket.location || "").toLowerCase();
          const assignmentScope = (adminAssignment.scope || "").toLowerCase();
          return ticketLocation === assignmentScope;
        }
        return true; // Always show tickets assigned to this admin (if no scope restriction)
      }
      
      // Priority 2: Unassigned tickets matching admin's domain/scope
      if (!ticket.assigned_to && adminAssignment.domain) {
        return ticketMatchesAdminAssignment({
          category: ticket.category_name,
          location: ticket.location,
        }, adminAssignment);
      }
      
      return false;
    }) as AdminTicketRow[];

    // Apply additional in-memory filters that rely on metadata (subcategory, TAT)
    if (subcategoryFilter) {
      allTickets = applySubcategoryFilter(allTickets, subcategoryFilter);
    }

    if (tatFilter) {
      allTickets = applyTATFilter(allTickets, tatFilter);
    }

    // Fetch ticket groups to calculate stats
    const allGroups = await db
      .select()
      .from(ticket_groups)
      .where(eq(ticket_groups.is_archived, false));

    // Count tickets in groups (grouped tickets)
    const groupedTicketIds = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(isNotNull(tickets.group_id));

    const groupedTicketIdSet = new Set(groupedTicketIds.map(t => t.id));
    
    // Filter grouped tickets based on admin assignment
    const groupedTickets = allTickets.filter(ticket => groupedTicketIdSet.has(ticket.id));
    
    // Available tickets are those not in any group
    const availableTickets = allTickets.filter(ticket => !groupedTicketIdSet.has(ticket.id));

    // Calculate stats
    const activeGroupsCount = allGroups.length;
    const groupedTicketsCount = groupedTickets.length;
    const availableTicketsCount = availableTickets.length;
    const totalTicketsCount = allTickets.length;

      return (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Ticket Groups
              </h1>
              <p className="text-muted-foreground text-sm">
                Organize tickets into groups for efficient bulk operations (comment, close, etc.)
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/admin/dashboard">
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
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Existing Groups
                </CardTitle>
              </div>
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
                  {availableTickets.length} {availableTickets.length === 1 ? "ticket" : "tickets"} available
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {availableTickets.length === 0 ? (
                <div className="py-12 text-center">
                  <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground font-medium">No tickets available for grouping</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Tickets will appear here once they are assigned to you or match your domain/scope
                  </p>
                </div>
              ) : (
                <SelectableTicketList
                  tickets={availableTickets.map(t => ({
                    id: t.id,
                    status: t.status_value || null,
                    description: t.description || null,
                    category_name: t.category_name || null,
                    location: t.location || null,
                    created_at: t.created_at,
                    updated_at: t.updated_at,
                  })) as unknown as Ticket[]}
                  basePath="/admin/dashboard"
                />
              )}
            </CardContent>
          </Card>
        </div>
      );
    } catch (error) {
      console.error("[AdminGroupsPage] Error:", error);
      return (
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-destructive">An error occurred while loading ticket groups. Please try again later.</p>
            </CardContent>
          </Card>
        </div>
      );
    }
  }
