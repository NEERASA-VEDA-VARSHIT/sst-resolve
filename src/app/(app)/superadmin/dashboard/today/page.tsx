import { db, tickets, ticket_statuses, categories, users } from "@/db";
import { desc, eq } from "drizzle-orm";
import { aliasedTable } from "drizzle-orm";
import type { Ticket } from "@/db/types-only";
import type { TicketMetadata } from "@/db/inferred-types";
import { TicketCard } from "@/components/layout/TicketCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, AlertTriangle, CheckCircle2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Use ISR (Incremental Static Regeneration) - cache for 30 seconds
// Removed force-dynamic to allow revalidation to work
export const revalidate = 30;

/**
 * Super Admin Today Pending Page
 * Note: Auth and role checks are handled by superadmin/layout.tsx
 */
export default async function SuperAdminTodayPendingPage() {

  const creatorUser = aliasedTable(users, "creator");
  
  const allTicketRows = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      description: tickets.description,
      location: tickets.location,
      status_id: tickets.status_id,
      status_value: ticket_statuses.value,
      category_id: tickets.category_id,
      category_name: categories.name,
      subcategory_id: tickets.subcategory_id,
      created_by: tickets.created_by,
      creator_full_name: creatorUser.full_name,
      creator_email: creatorUser.email,
      assigned_to: tickets.assigned_to,
      group_id: tickets.group_id,
      escalation_level: tickets.escalation_level,
      acknowledgement_due_at: tickets.acknowledgement_due_at,
      resolution_due_at: tickets.resolution_due_at,
      metadata: tickets.metadata,
      created_at: tickets.created_at,
      updated_at: tickets.updated_at,
    })
    .from(tickets)
    .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
    .leftJoin(categories, eq(tickets.category_id, categories.id))
    .leftJoin(creatorUser, eq(tickets.created_by, creatorUser.id))
    .orderBy(desc(tickets.created_at));
  
  // Transform to include status field for compatibility and extract metadata fields
  const allTickets = allTicketRows.map(t => {
    let ticketMetadata: TicketMetadata = {};
    if (t.metadata && typeof t.metadata === 'object' && !Array.isArray(t.metadata)) {
      ticketMetadata = t.metadata as TicketMetadata;
    }
    return {
      ...t,
      status: t.status_value || null,
      status_id: t.status_id || null,
      scope_id: null, // Tickets don't have scope_id in this query
      resolved_at: ticketMetadata.resolved_at ? new Date(ticketMetadata.resolved_at) : null,
      reopened_at: ticketMetadata.reopened_at ? new Date(ticketMetadata.reopened_at) : null,
      acknowledged_at: ticketMetadata.acknowledged_at ? new Date(ticketMetadata.acknowledged_at) : null,
      rating: ticketMetadata.rating as number | null || null,
      feedback: ticketMetadata.feedback as string | null || null,
    };
  });

  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDate = now.getDate();

  const pendingStatuses = new Set(["open", "in_progress", "awaiting_student", "reopened"]);

  // Filter tickets that are due today OR overdue (for the "Today Pending" page)
  // This page shows tickets with TAT due today, but also includes overdue tickets for visibility
  const todayPending = allTickets.filter(t => {
    const status = (t.status || "").toLowerCase();
    const hasPendingStatus = pendingStatuses.has(status);
    
    if (!hasPendingStatus) return false;
    
    // Use authoritative resolution_due_at field first, fallback to metadata
    const metadata = (t.metadata as TicketMetadata) || {};
    const tatDate = t.resolution_due_at || (metadata?.tatDate && typeof metadata.tatDate === 'string' ? new Date(metadata.tatDate) : null);
    
    if (!tatDate || isNaN(tatDate.getTime())) return false;
    
    const tatYear = tatDate.getFullYear();
    const tatMonth = tatDate.getMonth();
    const tatDay = tatDate.getDate();
    
    // Check if TAT is today
    const tatIsToday = 
      tatYear === todayYear &&
      tatMonth === todayMonth &&
      tatDay === todayDate;
    
    // Also include overdue tickets (past their TAT date) for visibility
    if (tatIsToday) return true;
    
    // Include overdue tickets (past their TAT date/time)
    const now = new Date();
    const tatDateTime = new Date(tatDate).getTime();
    const nowTime = now.getTime();
    
    return tatDateTime < nowTime;
  });

  // Calculate overdue tickets from todayPending tickets
  // These are tickets that are past their TAT date/time
  const overdueToday = todayPending.filter(t => {
    // Exclude tickets awaiting student response from overdue
    const normalizedStatus = (t.status || "").toLowerCase();
    if (normalizedStatus === "awaiting_student") {
      return false;
    }
    
    // Use authoritative resolution_due_at field first, fallback to metadata
    const metadata = (t.metadata as TicketMetadata) || {};
    const tatDate = t.resolution_due_at || (metadata?.tatDate && typeof metadata.tatDate === 'string' ? new Date(metadata.tatDate) : null);
    
    if (!tatDate || isNaN(tatDate.getTime())) return false;
    
    // Check if TAT date is in the past (before today, or today but past the time)
    const now = new Date();
    const tatDateTime = new Date(tatDate).getTime();
    const nowTime = now.getTime();
    
    // Ticket is overdue if TAT date/time is in the past
    return tatDateTime < nowTime;
  });

  const overdueTodayIds = new Set(overdueToday.map(t => t.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">Today Pending</h1>
          <p className="text-muted-foreground text-sm">
            Tickets with TAT due today
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/superadmin/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Total Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{todayPending.length}</div>
            <div className="text-sm text-muted-foreground mt-1">Due today</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{overdueToday.length}</div>
            <div className="text-sm text-muted-foreground mt-1">Past TAT date</div>
          </CardContent>
        </Card>
      </div>

      {todayPending.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="font-medium mb-1">No tickets pending today</p>
            <p className="text-sm text-muted-foreground text-center">
              All tickets are on track.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Tickets ({todayPending.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {todayPending.map((t) => (
              <div key={t.id} className={overdueTodayIds.has(t.id) ? "ring-2 ring-orange-400 dark:ring-orange-500 rounded-lg" : ""}>
                <TicketCard ticket={{
                  ...t,
                  status: t.status_value || null,
                  category_name: t.category_name || null,
                  creator_name: t.creator_full_name || null,
                  creator_email: t.creator_email || null,
                } as unknown as Ticket & { status?: string | null; category_name?: string | null; creator_name?: string | null; creator_email?: string | null }} basePath="/superadmin/dashboard" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

