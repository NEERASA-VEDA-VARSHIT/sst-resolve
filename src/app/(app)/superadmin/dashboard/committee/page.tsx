import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, tickets } from "@/db";
import { desc } from "drizzle-orm";
import { TicketCard } from "@/components/layout/TicketCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";

export default async function SuperAdminCommitteePage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  // Ensure user exists in database
  await getOrCreateUser(userId);

  // Get role from database (single source of truth)
  const role = await getUserRoleFromDB(userId);
  if (role !== "super_admin") redirect("/student/dashboard");

  // Get all tickets for super admin (with limit to prevent performance issues)
  let allTickets = [];
  try {
    allTickets = await db
      .select()
      .from(tickets)
      .orderBy(desc(tickets.created_at))
      .limit(1000); // Reasonable limit for committee view
  } catch (error) {
    console.error('[Super Admin Committee] Error fetching tickets:', error);
    // Continue with empty array
  }

  // Filter committee tickets - for now, we'll show all tickets
  // You can customize this filter based on your committee criteria
  const committeeTickets = allTickets;

  const totalCommittee = committeeTickets.length;
  const openCommittee = committeeTickets.filter(t => {
    const status = (t.status || "").toLowerCase();
    return !["closed", "resolved"].includes(status);
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Committee</h1>
          <p className="text-muted-foreground">
            View and manage committee-related tickets
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/superadmin/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-2">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Total Committee</p>
                <p className="text-3xl font-bold">{totalCommittee}</p>
              </div>
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-2">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Open Committee</p>
                <p className="text-3xl font-bold">{openCommittee}</p>
              </div>
              <Calendar className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ticket List */}
      {committeeTickets.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold mb-1">No committee tickets found</p>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Committee-related tickets will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {committeeTickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} basePath="/superadmin/dashboard" />
          ))}
        </div>
      )}
    </div>
  );
}

