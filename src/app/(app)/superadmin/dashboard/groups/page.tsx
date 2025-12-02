import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, tickets, categories, ticket_statuses, ticket_groups } from "@/db";
import { desc, eq, isNotNull } from "drizzle-orm";
import { TicketGrouping } from "@/components/admin/TicketGrouping";
import { SelectableTicketList } from "@/components/admin/SelectableTicketList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowLeft, Users, Package, CheckCircle2, TrendingUp } from "lucide-react";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import type { Ticket } from "@/db/types-only";

// Force dynamic rendering since we use auth headers
export const dynamic = "force-dynamic";

export default async function SuperAdminGroupsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  // Ensure user exists in database
  await getOrCreateUser(userId);

  // Get role from database (single source of truth)
  const role = await getUserRoleFromDB(userId);

  if (role !== 'super_admin') {
    redirect('/student/dashboard');
  }

  // Fetch all tickets for super admin with proper joins
  const allTicketRows = await db
    .select({
      id: tickets.id,
      status_id: tickets.status_id,
      status_value: ticket_statuses.value,
      category_id: tickets.category_id,
      category_name: categories.name,
      description: tickets.description,
      location: tickets.location,
      assigned_to: tickets.assigned_to,
      created_at: tickets.created_at,
      updated_at: tickets.updated_at,
    })
    .from(tickets)
    .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
    .leftJoin(categories, eq(tickets.category_id, categories.id))
    .orderBy(desc(tickets.created_at))
    .limit(1000); // Reasonable limit for grouping operations

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
              tickets={allTicketRows.map(t => ({
                id: t.id,
                status: t.status_value || null,
                description: t.description || null,
                category_name: t.category_name || null,
                location: t.location || null,
                created_at: t.created_at,
                updated_at: t.updated_at,
              })) as unknown as Ticket[]}
              basePath="/superadmin/dashboard"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

