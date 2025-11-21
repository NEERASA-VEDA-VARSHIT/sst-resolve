import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { tickets, users, roles, domains, scopes } from "@/db/schema";
import { desc, eq, or, and, isNull } from "drizzle-orm";
import { TicketGrouping } from "@/components/admin/TicketGrouping";
import { SelectableTicketList } from "@/components/admin/SelectableTicketList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";

export default async function AdminGroupsPage() {
  try {
    const { userId } = await auth();

    if (!userId) {
      redirect("/");
    }

    // Ensure user exists in database
    const dbUser = await getOrCreateUser(userId);
    if (!dbUser) {
      console.error("[AdminGroupsPage] Failed to create/fetch user");
      redirect("/");
    }

    const role = await getUserRoleFromDB(userId);
    if (role !== "admin" && role !== "super_admin") {
      redirect("/");
    }

    const [adminProfile] = await db
      .select({
        domain: domains.name,
        scope: scopes.name,
      })
      .from(users)
      .leftJoin(domains, eq(users.primary_domain_id, domains.id))
      .leftJoin(scopes, eq(users.primary_scope_id, scopes.id))
      .where(eq(users.id, dbUser.id))
      .limit(1);

    let allTickets;
    if (role === "admin") {
      const whereClause = or(
        eq(tickets.assigned_to, dbUser.id),
        and(isNull(tickets.assigned_to), adminProfile?.domain ? eq(tickets.location, adminProfile.domain) : isNull(tickets.location))
      );
      if (whereClause) {
        allTickets = await db
          .select()
          .from(tickets)
          .where(whereClause)
          .orderBy(desc(tickets.created_at));
      } else {
        allTickets = await db
          .select()
          .from(tickets)
          .orderBy(desc(tickets.created_at));
      }
    } else {
      allTickets = await db
        .select()
        .from(tickets)
        .orderBy(desc(tickets.created_at));
    }

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
              <Link href={role === "super_admin" ? "/superadmin/dashboard" : "/admin/dashboard"}>
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
                  basePath={role === "super_admin" ? "/superadmin/dashboard" : "/admin/dashboard"}
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
