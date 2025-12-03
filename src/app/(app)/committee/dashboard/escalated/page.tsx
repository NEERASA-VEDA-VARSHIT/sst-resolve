import { auth } from "@clerk/nextjs/server";
import type { TicketMetadata } from "@/db/inferred-types";
import { TicketCard } from "@/components/layout/TicketCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, TrendingUp, Calendar, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCachedUser, getCachedTicketStatuses, getCachedCommitteeTickets } from "@/lib/cache/cached-queries";
import type { Ticket } from "@/db/types-only";

// Force dynamic rendering since we use auth headers
export const dynamic = "force-dynamic";

/**
 * Committee Escalated Page
 * Note: Auth and role checks are handled by committee/layout.tsx
 */
export default async function CommitteeEscalatedPage() {
  // Layout ensures userId exists and user is a committee member
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized"); // TypeScript type guard - layout ensures this never happens

  // Use cached function for better performance (request-scoped deduplication)
  const user = await getCachedUser(userId);

  // Use cached function for better performance (request-scoped deduplication)
  const allTickets = await getCachedCommitteeTickets(user.id);

  // Transform to extract metadata fields
  const transformedTickets = allTickets.map(t => {
    let ticketMetadata: TicketMetadata = {};
    if (t.metadata && typeof t.metadata === 'object' && !Array.isArray(t.metadata)) {
      ticketMetadata = t.metadata as TicketMetadata;
    }
    const lastEscalationAt = ticketMetadata.last_escalation_at ? new Date(ticketMetadata.last_escalation_at) : null;
    
    return {
      ...t,
      status: t.status || null,
      status_id: t.status_id || null,
      scope_id: null,
      category_name: t.category_name || null,
      last_escalation_at: lastEscalationAt,
      resolved_at: ticketMetadata.resolved_at ? new Date(ticketMetadata.resolved_at) : null,
      reopened_at: ticketMetadata.reopened_at ? new Date(ticketMetadata.reopened_at) : null,
      acknowledged_at: ticketMetadata.acknowledged_at ? new Date(ticketMetadata.acknowledged_at) : null,
    };
  });

  // Filter to only escalated tickets
  const escalated = transformedTickets.filter(t => {
    const level = t.escalation_level;
    return typeof level === "number" && level > 0;
  });

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  // Use cached function for better performance (request-scoped deduplication)
  const ticketStatuses = await getCachedTicketStatuses();
  const finalStatuses = new Set(ticketStatuses.filter(s => s.is_final).map(s => s.value));

  const isOpen = (s: string | null) => !finalStatuses.has(s || "");

  const totalEscalated = escalated.length;
  const openEscalated = escalated.filter(t => isOpen(t.status)).length;
  const escalatedToday = escalated.filter(t => {
    try {
      if (!t.last_escalation_at) return false;
      const dt = new Date(t.last_escalation_at);
      if (isNaN(dt.getTime())) return false;
      return dt.getTime() >= startOfToday.getTime() && dt.getTime() <= endOfToday.getTime();
    } catch {
      return false;
    }
  }).length;

  // Sort by escalation count (most escalated first)
  const sortedEscalated = [...escalated].sort((a, b) => {
    const aCount = typeof a.escalation_level === "number" ? a.escalation_level : 0;
    const bCount = typeof b.escalation_level === "number" ? b.escalation_level : 0;
    if (bCount !== aCount) return bCount - aCount;

    const aDate = a.last_escalation_at ? new Date(a.last_escalation_at) : null;
    const bDate = b.last_escalation_at ? new Date(b.last_escalation_at) : null;
    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;
    if (isNaN(aDate.getTime()) || isNaN(bDate.getTime())) return 0;
    return bDate.getTime() - aDate.getTime();
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">Escalated Tickets</h1>
          <p className="text-muted-foreground text-sm">
            All escalated tickets requiring attention
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/committee/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
        </Button>
      </div>

      {/* Simple Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Total Escalated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalEscalated}</div>
            <div className="text-sm text-muted-foreground mt-1">All escalated tickets</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Open Escalated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">{openEscalated}</div>
            <div className="text-sm text-muted-foreground mt-1">Requiring action</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Escalated Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{escalatedToday}</div>
            <div className="text-sm text-muted-foreground mt-1">Last 24 hours</div>
          </CardContent>
        </Card>
      </div>

      {escalated.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TrendingUp className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="font-medium mb-1">No escalated tickets</p>
            <p className="text-sm text-muted-foreground text-center">
              All tickets are being handled smoothly.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Tickets ({escalated.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedEscalated.map((t) => {
              const escalationCount = typeof t.escalation_level === "number" ? t.escalation_level : 0;
              return (
                <div key={t.id} className="relative">
                  {escalationCount > 1 && (
                    <div className="absolute -top-2 -right-2 z-10">
                      <Badge variant="destructive" className="rounded-full px-2 py-1 text-xs font-bold">
                        {escalationCount}x
                      </Badge>
                    </div>
                  )}
                  <TicketCard ticket={{
                    ...t,
                    status_id: t.status_id || null,
                    scope_id: null,
                    status: t.status || null,
                    category_name: t.category_name || null,
                  } as unknown as Ticket & { status?: string | null; category_name?: string | null; creator_name?: string | null; creator_email?: string | null }} basePath="/committee/dashboard" />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
