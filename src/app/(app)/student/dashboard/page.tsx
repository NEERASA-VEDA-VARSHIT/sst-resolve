import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, tickets } from "@/db";
import { desc, eq, or, like } from "drizzle-orm";
import { TicketCard } from "@/components/layout/TicketCard";
import { TicketSearch } from "@/components/student/TicketSearch";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Search } from "lucide-react";
import { StatsCards } from "@/components/dashboard/StatsCards";

export default async function StudentDashboardPage({ 
  searchParams 
}: { 
  searchParams?: Promise<Record<string, string>> 
}) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect("/");
  }

  const userNumber = sessionClaims?.metadata?.userNumber as string | undefined;
  
  if (!userNumber) {
    redirect("/profile");
  }

  const params = (await (searchParams || Promise.resolve({}))) || {};
  const search = params.search || "";
  const statusFilter = params.status || "";
  const categoryFilter = params.category || "";

  let allTickets = await db
    .select()
    .from(tickets)
    .where(eq(tickets.userNumber, userNumber))
    .orderBy(desc(tickets.createdAt));

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
    if (statusFilter === "resolved") {
      allTickets = allTickets.filter(t => t.status === "resolved" || t.status === "closed");
    } else {
      allTickets = allTickets.filter(t => t.status === statusFilter);
    }
  }

  if (categoryFilter) {
    allTickets = allTickets.filter(t => t.category === categoryFilter);
  }

  // Calculate stats
  const stats = {
    total: allTickets.length,
    open: allTickets.filter(t => t.status === "open").length,
    inProgress: allTickets.filter(t => t.status === "in_progress").length,
    resolved: allTickets.filter(t => t.status === "resolved" || t.status === "closed").length,
    escalated: allTickets.filter(t => (Number(t.escalationCount) || 0) > 0).length,
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            My Tickets
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage and track all your support tickets
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/public">
            <Button variant="outline" className="shadow-sm">
              Public Dashboard
            </Button>
          </Link>
          <Link href="/student/dashboard/ticket/new">
            <Button className="shadow-md hover:shadow-lg transition-shadow">
              <Plus className="w-4 h-4 mr-2" />
              New Ticket
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      {allTickets.length > 0 && <StatsCards stats={stats} />}

      {/* Search and Filters */}
      <Card className="border-2">
        <CardContent className="p-6">
          <TicketSearch />
        </CardContent>
      </Card>

      {allTickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed rounded-lg bg-muted/30">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
              <Plus className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No tickets yet</h3>
            <p className="text-muted-foreground max-w-sm">
              Get started by creating your first support ticket. We're here to help!
            </p>
            <Link href="/student/dashboard/ticket/new" className="inline-block mt-4">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Ticket
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {allTickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  );
}

