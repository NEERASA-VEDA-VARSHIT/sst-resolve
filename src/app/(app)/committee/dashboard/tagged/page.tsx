import { auth } from "@clerk/nextjs/server";
import type { Ticket } from "@/db/types-only";
import { getCachedUser } from "@/lib/cache/cached-queries";
import { TicketCard } from "@/components/layout/TicketCard";
import TicketSearch from "@/components/student/TicketSearch";
import { Card, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { getTaggedTickets } from "@/lib/committee/getTaggedTickets";
import { filterTickets } from "@/lib/ticket/filters/filterTickets";
import { calculateTicketStats } from "@/lib/committee/calculateStats";

export const dynamic = "force-dynamic";

/**
 * Committee Tagged Tickets Page
 * Note: Auth is handled by committee/layout.tsx
 */
export default async function CommitteeTaggedTicketsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  // Layout ensures userId exists and user is created via getOrCreateUser
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized"); // TypeScript type guard - layout ensures this never happens

  // Use cached function for better performance (request-scoped deduplication)
  const user = await getCachedUser(userId);

  // Await searchParams (Next.js 15)
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const params = resolvedSearchParams || {};
  const search = (typeof params["search"] === "string" ? params["search"] : params["search"]?.[0]) || "";
  const statusFilter = (typeof params["status"] === "string" ? params["status"] : params["status"]?.[0]) || "";
  const categoryFilter = (typeof params["category"] === "string" ? params["category"] : params["category"]?.[0]) || "";

  // Fetch all tagged tickets
  const allTickets = await getTaggedTickets(user.id);

  // Apply filters
  const filteredTickets = filterTickets(allTickets, search, statusFilter, categoryFilter);

  // Calculate stats from all tickets (before filtering)
  const stats = calculateTicketStats(allTickets);

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Tagged to My Committee
          </h1>
          <p className="text-muted-foreground">
            Tickets tagged to your committee by admins. You can step in and resolve these tickets.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {allTickets.length > 0 && <StatsCards stats={stats} />}

      {/* Search and Filters */}
      <TicketSearch />

      {/* Tagged Tickets List */}
      {(search || statusFilter || categoryFilter ? filteredTickets.length === 0 : false) ? (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-sm text-muted-foreground text-center">
              No tickets match your filters
            </p>
          </CardContent>
        </Card>
      ) : filteredTickets.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold mb-1">No tagged tickets</p>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Tickets tagged to your committee by admins will appear here. You can step in and resolve these tickets.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredTickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket as unknown as Ticket & { status?: string | null; category_name?: string | null; creator_name?: string | null; creator_email?: string | null }}
              basePath="/committee/dashboard"
            />
          ))}
        </div>
      )}
    </div>
  );
}
