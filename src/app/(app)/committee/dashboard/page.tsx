import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, tickets } from "@/db";
import { desc, eq } from "drizzle-orm";
import { TicketCard } from "@/components/layout/TicketCard";
import { TicketSearch } from "@/components/student/TicketSearch";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { StatsCards } from "@/components/dashboard/StatsCards";

export default async function CommitteeDashboardPage({ 
  searchParams 
}: { 
  searchParams?: Record<string, string | undefined> 
}) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect("/");
  }

  const role = sessionClaims?.metadata?.role || "student";
  
  if (role !== "committee") {
    redirect("/student/dashboard");
  }

  const params = searchParams || {};
  const search = params.search || "";
  const statusFilter = params.status || "";
  const categoryFilter = params.category || "";

  // Get all tickets created by this committee member
  // For committee, userNumber is set to userId when creating tickets
  let allTickets = await db
    .select()
    .from(tickets)
    .where(eq(tickets.userNumber, userId))
    .orderBy(desc(tickets.createdAt));

  // Filter by category = "Committee"
  allTickets = allTickets.filter(t => t.category === "Committee");

  // Apply filters
  if (search) {
    const searchLower = search.toLowerCase();
    allTickets = allTickets.filter(t => 
      t.id.toString().includes(search) ||
      (t.description || "").toLowerCase().includes(searchLower) ||
      (t.subcategory || "").toLowerCase().includes(searchLower)
    );
  }

  if (statusFilter) {
    if (statusFilter.toLowerCase() === "resolved") {
      allTickets = allTickets.filter(t => t.status === "resolved" || t.status === "closed");
    } else {
      allTickets = allTickets.filter(t => (t.status || "").toLowerCase() === statusFilter.toLowerCase());
    }
  }

  if (categoryFilter) {
    allTickets = allTickets.filter(t => (t.category || "").toLowerCase() === categoryFilter.toLowerCase());
  }

  const stats = {
    total: allTickets.length,
    open: allTickets.filter(t => t.status === 'open').length,
    inProgress: allTickets.filter(t => t.status === 'in_progress').length,
    resolved: allTickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
    escalated: allTickets.filter(t => (Number(t.escalationCount) || 0) > 0).length,
  };

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Committee Dashboard
          </h1>
          <p className="text-muted-foreground">
            Manage and track all committee tickets
          </p>
        </div>
        <Button asChild>
          <Link href="/committee/dashboard/ticket/new">
            <Plus className="w-4 h-4 mr-2" />
            New Ticket
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      {allTickets.length > 0 && <StatsCards stats={stats} />}

      {/* Search and Filters */}
      <TicketSearch />

      {/* Tickets List */}
      {allTickets.length === 0 ? (
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
          {allTickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} basePath="/committee/dashboard" />
          ))}
        </div>
      )}
    </div>
  );
}

