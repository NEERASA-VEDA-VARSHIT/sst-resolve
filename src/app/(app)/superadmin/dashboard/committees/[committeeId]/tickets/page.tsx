import { notFound } from "next/navigation";
import { db, committees } from "@/db";
import { eq } from "drizzle-orm";
import { TicketCard } from "@/components/layout/TicketCard";
import TicketSearch from "@/components/student/TicketSearch";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { filterTickets } from "@/lib/ticket/filterTickets";
import { calculateTicketStats } from "@/lib/committee/calculateStats";
import { getCommitteeTicketsById } from "@/lib/committee/getCommitteeTicketsById";
import type { Ticket } from "@/db/types-only";

export const dynamic = "force-dynamic";

/**
 * Super Admin Committee Tickets Page
 * Note: Auth and role checks are handled by superadmin/layout.tsx
 */
export default async function CommitteeTicketsPage({
  params,
  searchParams
}: {
  params: Promise<{ committeeId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {

  const { committeeId } = await params;
  const id = Number(committeeId);
  if (!Number.isFinite(id)) {
    notFound();
  }

  // Get committee with head_id
  const [committee] = await db
    .select({
      id: committees.id,
      name: committees.name,
      description: committees.description,
      contact_email: committees.contact_email,
      head_id: committees.head_id,
    })
    .from(committees)
    .where(eq(committees.id, id))
    .limit(1);

  if (!committee || !committee.head_id) {
    notFound();
  }

  // Await searchParams (Next.js 15)
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const paramsObj = resolvedSearchParams || {};
  const search = (typeof paramsObj["search"] === "string" ? paramsObj["search"] : paramsObj["search"]?.[0]) || "";
  const statusFilter = (typeof paramsObj["status"] === "string" ? paramsObj["status"] : paramsObj["status"]?.[0]) || "";
  const categoryFilter = (typeof paramsObj["category"] === "string" ? paramsObj["category"] : paramsObj["category"]?.[0]) || "";

  // Use the same helper function used by committee dashboard for consistency
  const allTickets = await getCommitteeTicketsById(id);

  // Apply filters
  const filteredTickets = filterTickets(allTickets, search, statusFilter, categoryFilter);

  // Calculate stats from all tickets (before filtering)
  const stats = calculateTicketStats(allTickets);

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/superadmin/dashboard/committees">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Committees
              </Link>
            </Button>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            {committee.name} - Tickets
          </h1>
          <p className="text-muted-foreground">
            Tickets created by this committee or tagged to this committee
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {allTickets.length > 0 && <StatsCards stats={stats} />}

      {/* Search and Filters */}
      <TicketSearch />

      {/* Tickets List */}
      {filteredTickets.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold mb-1">No tickets found</p>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              {search || statusFilter || categoryFilter
                ? "Try adjusting your search or filters"
                : "This committee has not raised any tickets yet"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredTickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket as unknown as Ticket & { status?: string | null; category_name?: string | null; creator_name?: string | null; creator_email?: string | null }}
              basePath="/superadmin/dashboard"
            />
          ))}
        </div>
      )}
    </div>
  );
}
