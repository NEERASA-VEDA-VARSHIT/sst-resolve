import { auth } from "@clerk/nextjs/server";

import { redirect } from "next/navigation";

import { db, tickets, ticket_groups } from "@/db";

import { eq, isNotNull } from "drizzle-orm";

import { TicketGrouping } from "@/components/admin/TicketGrouping";

import { SelectableTicketList } from "@/components/admin/SelectableTicketList";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";

import Link from "next/link";

import { ArrowLeft, Users, Package, CheckCircle2, TrendingUp } from "lucide-react";

import { getOrCreateUser } from "@/lib/auth/user-sync";

import { getUserRoleFromDB } from "@/lib/auth/db-roles";

import { getAllCommitteeTickets } from "@/lib/committee/getAllCommitteeTickets";

import { AdminTicketFilters } from "@/components/admin/AdminTicketFilters";

import type { Ticket } from "@/db/types-only";



// Force dynamic rendering since we use auth headers

export const dynamic = "force-dynamic";



export default async function CommitteeGroupsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {

  try {

    const { userId } = await auth();



    if (!userId) {

      redirect("/");

    }



    const user = await getOrCreateUser(userId);

    if (!user) {

      console.error("[CommitteeGroupsPage] Failed to create/fetch user");

      redirect("/");

    }



    // Get role from database (single source of truth)

    const role = await getUserRoleFromDB(userId);

    if (role !== "committee") {

      redirect("/committee/dashboard");

    }



    // Parse search params
    const resolvedSearchParams = searchParams ? await searchParams : {};
    const params = resolvedSearchParams || {};
    const statusFilter = (typeof params["status"] === "string" ? params["status"] : params["status"]?.[0]) || "";
    const categoryFilter = (typeof params["category"] === "string" ? params["category"] : params["category"]?.[0]) || "";
    const searchQuery = (typeof params["search"] === "string" ? params["search"] : params["search"]?.[0]) || "";
    const locationFilter = (typeof params["location"] === "string" ? params["location"] : params["location"]?.[0]) || "";

    // Fetch all committee-accessible tickets
    const allCommitteeTickets = await getAllCommitteeTickets(user.id);

    // Apply filters
    let allTickets = allCommitteeTickets;

    if (statusFilter) {
      const normalizedStatus = statusFilter.toLowerCase();
      if (normalizedStatus === "escalated") {
        allTickets = allTickets.filter(t => (t.escalation_level || 0) > 0);
      } else {
        allTickets = allTickets.filter(t => {
          const ticketStatus = (t.status || "").toLowerCase();
          return ticketStatus === normalizedStatus;
        });
      }
    }

    if (categoryFilter) {
      allTickets = allTickets.filter(t => {
        const categoryName = (t.category_name || "").toLowerCase();
        return categoryName.includes(categoryFilter.toLowerCase());
      });
    }

    if (locationFilter) {
      allTickets = allTickets.filter(t => {
        const location = (t.location || "").toLowerCase();
        return location.includes(locationFilter.toLowerCase());
      });
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      allTickets = allTickets.filter(t => {
        return (
          t.id.toString().includes(query) ||
          (t.description || "").toLowerCase().includes(query) ||
          (t.title || "").toLowerCase().includes(query)
        );
      });
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



    const groupedTicketIdSet = new Set(groupedTicketIds.map((t) => t.id));



    // Filter grouped tickets based on committee access

    const groupedTickets = allTickets.filter((ticket) => groupedTicketIdSet.has(ticket.id));



    // Available tickets are those not in any group

    const availableTickets = allTickets.filter((ticket) => !groupedTicketIdSet.has(ticket.id));



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

            <Link href="/committee/dashboard">

              <ArrowLeft className="w-4 h-4 mr-2" />

              Back to Dashboard

            </Link>

          </Button>

        </div>



        {/* Filters */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminTicketFilters />
          </CardContent>
        </Card>



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



        {/* Select Tickets to Group */}

        <Card className="shadow-sm">

          <CardHeader>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">

              <CardTitle>Select Tickets to Group</CardTitle>

              <Badge variant="secondary" className="text-sm w-fit">

                {allTickets.length} {allTickets.length === 1 ? "ticket" : "tickets"} available

              </Badge>

            </div>

          </CardHeader>

          <CardContent>

            {allTickets.length === 0 ? (

              <div className="py-12 text-center">

                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />

                <p className="text-muted-foreground font-medium">No tickets available for grouping</p>

                <p className="text-sm text-muted-foreground mt-1">

                  Tickets will appear here once they are created by you or tagged to your committee

                </p>

              </div>

            ) : (

              <SelectableTicketList

                tickets={allTickets.map((t) => ({

                  id: t.id,

                  status: t.status || null,

                  description: t.description || null,

                  category_name: t.category_name || null,

                  location: t.location || null,

                  created_at: t.created_at,

                  updated_at: t.updated_at,

                })) as unknown as Ticket[]}

                basePath="/committee/dashboard"

              />

            )}

          </CardContent>

        </Card>

      </div>

    );

  } catch (error) {

    console.error("[CommitteeGroupsPage] Error:", error);

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

