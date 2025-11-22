import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, tickets, categories, ticket_statuses } from "@/db";
import { desc, eq } from "drizzle-orm";
import { TicketGrouping } from "@/components/admin/TicketGrouping";
import { SelectableTicketList } from "@/components/admin/SelectableTicketList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowLeft, Users, Package } from "lucide-react";
import { getCachedAdminUser, getCachedAdminAssignment } from "@/lib/admin/cached-queries";
import { ticketMatchesAdminAssignment } from "@/lib/admin-assignment";
import type { Ticket } from "@/db/types-only";

export default async function AdminGroupsPage() {
  try {
    const { userId } = await auth();

    if (!userId) {
      redirect("/");
    }

    // Use cached functions for better performance
    const { dbUser, role } = await getCachedAdminUser(userId);
    
    if (!dbUser) {
      console.error("[AdminGroupsPage] Failed to create/fetch user");
      redirect("/");
    }

    if (role === "student") redirect("/student/dashboard");
    // Super admin should use superadmin groups page

    // Get admin's domain/scope assignment (cached)
    const adminAssignment = await getCachedAdminAssignment(userId);

    // Fetch tickets with proper joins for better data
    const allTicketRows = await db
      .select({
        id: tickets.id,
        status_id: tickets.status_id,
        status_value: ticket_statuses.value,
        status_label: ticket_statuses.label,
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

    // Filter tickets based on admin assignment
    const allTickets = allTicketRows.filter(ticket => {
      // For admin role, filter by assignment
      if (role === "admin") {
        return ticketMatchesAdminAssignment({
          category: ticket.category_name,
          location: ticket.location,
        }, adminAssignment);
      }
      // For other roles, show all tickets
      return true;
    });

      return (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">
                Ticket Groups
              </h1>
              <p className="text-muted-foreground text-sm">
                Organize tickets into groups for efficient bulk operations
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Tickets</p>
                    <p className="text-2xl font-bold mt-1">{allTickets.length}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Package className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Available for Grouping</p>
                    <p className="text-2xl font-bold mt-1">{allTickets.length}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Groups</p>
                    <p className="text-2xl font-bold mt-1">-</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-emerald-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Existing Groups */}
          <Card>
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
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Select Tickets to Group</CardTitle>
                <Badge variant="secondary" className="text-sm">
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
                    Tickets will appear here once they are assigned to you or match your domain/scope
                  </p>
                </div>
              ) : (
                <SelectableTicketList
                  tickets={allTickets.map(t => ({
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
