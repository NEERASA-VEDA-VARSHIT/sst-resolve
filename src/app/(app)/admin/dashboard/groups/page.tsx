import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { tickets, staff } from "@/db/schema";
import { desc, eq, or, isNull } from "drizzle-orm";
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
      .select()
        .from(tickets)
        .orderBy(desc(tickets.created_at))
        .limit(limit);

      // Filter tickets based on admin role
      if (role === "admin") {
        // Get admin's staff record
        const [adminStaff] = await db
          .select({ id: staff.id })
          .from(staff)
          .where(eq(staff.user_id, dbUser.id))
          .limit(1);

        if (adminStaff) {
          allTickets = await db
            .select()
            .from(tickets)
            .where(
              or(
                eq(tickets.assigned_to, adminStaff.id),
                isNull(tickets.assigned_to)
              )
            )
            .orderBy(desc(tickets.created_at));
        } else {
          // No staff record, show unassigned tickets only
          allTickets = await db
            .select()
            .from(tickets)
            .where(isNull(tickets.assigned_to))
            .orderBy(desc(tickets.created_at));
        }
      }
      // Super admin can see all tickets

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
