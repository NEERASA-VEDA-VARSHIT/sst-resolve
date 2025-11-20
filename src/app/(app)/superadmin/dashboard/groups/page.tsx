import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, tickets } from "@/db";
import { desc } from "drizzle-orm";
import { TicketGrouping } from "@/components/admin/TicketGrouping";
import { SelectableTicketList } from "@/components/admin/SelectableTicketList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";

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

  // Fetch all tickets for super admin (with limit to prevent performance issues)
  const allTickets = await db
    .select()
    .from(tickets)
    .orderBy(desc(tickets.created_at))
    .limit(1000); // Reasonable limit for grouping operations

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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

      <Card>
        <CardHeader>
          <CardTitle>Select Tickets to Group</CardTitle>
        </CardHeader>
        <CardContent>
          {allTickets.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No tickets available for grouping
            </div>
          ) : (
            <SelectableTicketList
              tickets={allTickets}
              basePath="/superadmin/dashboard"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

