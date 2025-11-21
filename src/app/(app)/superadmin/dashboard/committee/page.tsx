import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, tickets, ticket_statuses } from "@/db";
import { desc, eq } from "drizzle-orm";
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
  type TicketWithStatus = typeof tickets.$inferSelect & {
    status_value: string | null;
    status: string | null;
  };
  let allTickets: TicketWithStatus[] = [];
  try {
    const ticketRows = await db
      .select({
        id: tickets.id,
        title: tickets.title,
        description: tickets.description,
        location: tickets.location,
        status_id: tickets.status_id,
        category_id: tickets.category_id,
        subcategory_id: tickets.subcategory_id,
        sub_subcategory_id: tickets.sub_subcategory_id,
        created_by: tickets.created_by,
        assigned_to: tickets.assigned_to,
        acknowledged_by: tickets.acknowledged_by,
        group_id: tickets.group_id,
        escalation_level: tickets.escalation_level,
        tat_extended_count: tickets.tat_extended_count,
        last_escalation_at: tickets.last_escalation_at,
        acknowledgement_tat_hours: tickets.acknowledgement_tat_hours,
        resolution_tat_hours: tickets.resolution_tat_hours,
        acknowledgement_due_at: tickets.acknowledgement_due_at,
        resolution_due_at: tickets.resolution_due_at,
        acknowledged_at: tickets.acknowledged_at,
        reopened_at: tickets.reopened_at,
        sla_breached_at: tickets.sla_breached_at,
        reopen_count: tickets.reopen_count,
        rating: tickets.rating,
        feedback_type: tickets.feedback_type,
        rating_submitted: tickets.rating_submitted,
        feedback: tickets.feedback,
        is_public: tickets.is_public,
        admin_link: tickets.admin_link,
        student_link: tickets.student_link,
        slack_thread_id: tickets.slack_thread_id,
        external_ref: tickets.external_ref,
        metadata: tickets.metadata,
        created_at: tickets.created_at,
        updated_at: tickets.updated_at,
        resolved_at: tickets.resolved_at,
        status_value: ticket_statuses.value,
      })
      .from(tickets)
      .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
      .orderBy(desc(tickets.created_at))
      .limit(1000); // Reasonable limit for committee view
    
    allTickets = ticketRows.map(t => ({
      ...t,
      status_value: t.status_value ?? null,
      status: t.status_value ?? null,
    })) as TicketWithStatus[];
  } catch (error) {
    console.error('[Super Admin Committee] Error fetching tickets:', error);
    // Continue with empty array
  }

  // Filter committee tickets - for now, we'll show all tickets
  // You can customize this filter based on your committee criteria
  const committeeTickets = allTickets;

  const totalCommittee = committeeTickets.length;
  const openCommittee = committeeTickets.filter(t => {
    const status = ((t as { status?: string | null }).status || "").toLowerCase();
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

