import { auth } from "@clerk/nextjs/server";
import { db, categories, domains } from "@/db";
import { eq, inArray } from "drizzle-orm";
import { TicketCard } from "@/components/layout/TicketCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { AdminTicketFilters } from "@/components/admin/AdminTicketFilters";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { Button } from "@/components/ui/button";
import { FileText, AlertCircle, TrendingUp, Calendar } from "lucide-react";
import { getCachedAdminUser, getCachedAdminAssignment, getCachedAdminTickets, getCachedTicketStatuses } from "@/lib/cache/cached-queries";
import { ticketMatchesAdminAssignment } from "@/lib/assignment/admin-assignment";
import type { Ticket } from "@/db/types-only";
import type { AdminTicketRow } from "@/lib/ticket/adminTicketFilters";
import {
  applySearchFilter,
  applyCategoryFilter,
  applySubcategoryFilter,
  applyLocationFilter,
  applyStatusFilter,
  applyEscalatedFilter,
  applyUserFilter,
  applyDateRangeFilter,
  applyTATFilter,
  calculateTicketStats,
} from "@/lib/ticket/adminTicketFilters";
import { parseTicketMetadata } from "@/db/inferred-types";
import { isOpenStatus, normalizeStatus } from "@/lib/ticket/normalizeStatus";
import type { TicketStatusValue } from "@/conf/constants";

// Force dynamic rendering for authenticated routes
export const dynamic = 'force-dynamic';
// Revalidate every 30 seconds for fresh data
export const revalidate = 30;

/**
 * Admin Dashboard Page
 * Note: Auth and role checks are handled by admin/layout.tsx
 */
export default async function AdminDashboardPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  // Layout ensures userId exists and user is an admin
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized"); // TypeScript type guard - layout ensures this never happens

  // Use cached functions for better performance (request-scoped deduplication)
  // Layout already ensures user exists via getOrCreateUser, so adminDbUser will exist
  const { dbUser: adminDbUser } = await getCachedAdminUser(userId);

  const adminUserId = adminDbUser.id;

  // Await searchParams (Next.js 15)
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const params = resolvedSearchParams || {};
  const activeTab = (typeof params["tab"] === "string" ? params["tab"] : params["tab"]?.[0]) || "tickets";
  const searchQuery = (typeof params["search"] === "string" ? params["search"] : params["search"]?.[0]) || "";
  const category = (typeof params["category"] === "string" ? params["category"] : params["category"]?.[0]) || "";
  const subcategory = (typeof params["subcategory"] === "string" ? params["subcategory"] : params["subcategory"]?.[0]) || "";
  const location = (typeof params["location"] === "string" ? params["location"] : params["location"]?.[0]) || "";
  const tat = (typeof params["tat"] === "string" ? params["tat"] : params["tat"]?.[0]) || "";
  const status = (typeof params["status"] === "string" ? params["status"] : params["status"]?.[0]) || "";
  const createdFrom = (typeof params["from"] === "string" ? params["from"] : params["from"]?.[0]) || "";
  const createdTo = (typeof params["to"] === "string" ? params["to"] : params["to"]?.[0]) || "";
  const user = (typeof params["user"] === "string" ? params["user"] : params["user"]?.[0]) || "";
  const sort = (typeof params["sort"] === "string" ? params["sort"] : params["sort"]?.[0]) || "newest";
  const escalated = (typeof params["escalated"] === "string" ? params["escalated"] : params["escalated"]?.[0]) || "";

  // Get admin's domain/scope assignment (cached)
  const adminAssignment = await getCachedAdminAssignment(userId);
  const hasAssignment = !!adminAssignment.domain;

  // Fetch tickets using cached function (optimized query with request-scoped caching)
  const ticketRows = await getCachedAdminTickets(adminUserId, adminAssignment);

  // Get ticket statuses for final status check
  // Store canonical values for final statuses (resolved/closed/etc.)
  const ticketStatuses = await getCachedTicketStatuses();
  const finalStatusValues = new Set<TicketStatusValue>(
    ticketStatuses
      .filter((s) => s.is_final)
      .map((s) => normalizeStatus(s.value))
      .filter((s): s is TicketStatusValue => s !== null)
  );

  // Transform to AdminTicketRow format (properly typed)
  let allTickets: AdminTicketRow[] = ticketRows.map(ticket => ({
    ...ticket,
    status_id: ticket.status_id ?? null,
    status: ticket.status_value || null,
  }));

  // Get category names and domains for all tickets (for filtering logic)
  const categoryMap = new Map<number, { name: string; domain: string | null }>();
  const categoryIds = [...new Set(allTickets.map(t => t.category_id).filter(Boolean) as number[])];
  if (categoryIds.length > 0) {
    const categoryRecords = await db
      .select({ 
        id: categories.id, 
        name: categories.name,
        domainName: domains.name,
      })
      .from(categories)
      .leftJoin(domains, eq(categories.domain_id, domains.id))
      .where(inArray(categories.id, categoryIds));
    for (const cat of categoryRecords) {
      categoryMap.set(cat.id, { name: cat.name, domain: cat.domainName || null });
    }
  }

  // Get domains from categories this admin is assigned to
  const { getAdminAssignedCategoryDomains } = await import("@/lib/assignment/admin-assignment");
  const assignedCategoryDomains = adminUserId 
    ? await getAdminAssignedCategoryDomains(adminUserId)
    : [];

  /**
   * Filter tickets by admin assignment
   * 
   * Priority order:
   * 1. Tickets explicitly assigned to this admin (via assigned_to)
   *    - If admin has scope, also filter by scope match
   * 2. Tickets in domains from categories this admin is assigned to
   *    - If admin has scope, also filter by scope match
   * 3. Unassigned tickets matching admin's domain/scope (from primary assignment)
   *    - Allows admins to pick up unassigned tickets in their domain
   */
  if (adminUserId) {
    allTickets = allTickets.filter(t => {
      // Priority 1: Explicitly assigned tickets
      if (t.assigned_to === adminUserId) {
        // If admin has a scope, filter by scope for assigned tickets too
        if (adminAssignment.scope && t.location) {
          const ticketLocation = (t.location || "").toLowerCase();
          const assignmentScope = (adminAssignment.scope || "").toLowerCase();
          return ticketLocation === assignmentScope;
        }
        return true; // Always show tickets assigned to this admin (if no scope restriction)
      }
      
      // Priority 2: Tickets in domains from categories admin is assigned to
      const ticketCategoryInfo = t.category_id ? categoryMap.get(t.category_id) : null;
      if (ticketCategoryInfo?.domain && assignedCategoryDomains.includes(ticketCategoryInfo.domain)) {
        // Admin is assigned to this category's domain
        // If admin has a scope, filter by scope
        if (adminAssignment.scope && t.location) {
          const ticketLocation = (t.location || "").toLowerCase();
          const assignmentScope = (adminAssignment.scope || "").toLowerCase();
          return ticketLocation === assignmentScope;
        }
        // No scope restriction, show all tickets in this domain
        return true;
      }
      
      // Priority 3: Unassigned tickets matching admin's domain/scope
      if (!t.assigned_to && hasAssignment) {
        const ticketCategory = ticketCategoryInfo?.name || null;
        return ticketMatchesAdminAssignment(
          { category: ticketCategory, location: t.location },
          adminAssignment
        );
      }
      
      return false;
    });
  } else {
    // If user ID not found, show no tickets
    allTickets = [];
  }

  // Apply filters using centralized helper functions
  allTickets = applySearchFilter(allTickets, searchQuery);
  allTickets = applyCategoryFilter(allTickets, category, categoryMap);
  allTickets = applySubcategoryFilter(allTickets, subcategory);
  allTickets = applyLocationFilter(allTickets, location);
  allTickets = applyStatusFilter(allTickets, status);
  allTickets = applyEscalatedFilter(allTickets, escalated);
  allTickets = applyUserFilter(allTickets, user);
  allTickets = applyDateRangeFilter(allTickets, createdFrom, createdTo);
  allTickets = applyTATFilter(allTickets, tat);

  // Sort
  if (sort === "oldest") {
    allTickets = [...allTickets].reverse();
  }

  // Calculate statistics using centralized helper
  const stats = calculateTicketStats(allTickets);

  // Calculate today pending count (tickets with TAT due today that are not resolved)
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  
  const todayPending = allTickets.filter(t => {
    // Must be open (not final status)
    const status = t.status || t.status_value;
    if (!isOpenStatus(status, finalStatusValues)) return false;
    
    // Must have TAT date due today
    const metadata = parseTicketMetadata(t.metadata);
    const tatDateStr = metadata.tatDate;
    if (!tatDateStr || typeof tatDateStr !== 'string') return false;
    
    const tatDate = new Date(tatDateStr);
    if (isNaN(tatDate.getTime())) return false;
    
    return tatDate.getTime() >= startOfToday.getTime() && 
           tatDate.getTime() <= endOfToday.getTime();
  }).length;

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground">
              Manage and monitor all assigned tickets
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" asChild>
              <Link href="/admin/dashboard/today">
                <Calendar className="w-4 h-4 mr-2" />
                Today Pending
                {todayPending > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-amber-500 text-white">
                    {todayPending}
                  </span>
                )}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/dashboard/escalated">
                <AlertCircle className="w-4 h-4 mr-2" />
                Escalated
                {stats.escalated > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-red-500 text-white">
                    {stats.escalated}
                  </span>
                )}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/dashboard/analytics">
                <TrendingUp className="w-4 h-4 mr-2" />
                Analytics
              </Link>
            </Button>
          </div>
        </div>

        <Tabs defaultValue="tickets" value={activeTab} className="w-full">
          <TabsList className="mb-6 bg-muted/50">
            <TabsTrigger value="tickets" asChild>
              <Link href="/admin/dashboard">Tickets</Link>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tickets" className="space-y-6">
            {/* Stats Cards */}
            <StatsCards stats={stats} />

            <AdminTicketFilters />

            <div className="flex justify-between items-center pt-4">
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <FileText className="w-6 h-6" />
                My Assigned Tickets
              </h2>
              <p className="text-sm text-muted-foreground">
                {allTickets.length} {allTickets.length === 1 ? 'ticket' : 'tickets'}
              </p>
            </div>

            {allTickets.length === 0 ? (
              <Card className="border-2 border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-semibold mb-1">No tickets found</p>
                  <p className="text-sm text-muted-foreground text-center max-w-md">
                    Tickets assigned to you will appear here. Use the filters above to search for specific tickets.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {allTickets.map((ticket) => {
                  // Transform to TicketCard expected format with proper types
                  const ticketForCard: Ticket & { 
                    status?: string | null; 
                    category_name?: string | null; 
                    creator_name?: string | null; 
                    creator_email?: string | null;
                  } = {
                    id: ticket.id,
                    title: ticket.title,
                    description: ticket.description,
                    location: ticket.location,
                    status_id: ticket.status_id ?? 0,
                    category_id: ticket.category_id ?? null,
                    subcategory_id: ticket.subcategory_id ?? null,
                    scope_id: null,
                    created_by: ticket.created_by,
                    assigned_to: ticket.assigned_to,
                    escalation_level: ticket.escalation_level ?? 0,
                    acknowledgement_due_at: ticket.acknowledgement_due_at,
                    resolution_due_at: ticket.resolution_due_at,
                    metadata: ticket.metadata,
                    created_at: ticket.created_at,
                    updated_at: ticket.updated_at,
                    status: ticket.status || ticket.status_value || null,
                    category_name: ticket.category_name || null,
                    creator_name: ticket.creator_full_name || null,
                    creator_email: ticket.creator_email || null,
                  };
                  return (
                    <TicketCard 
                      key={ticket.id} 
                      ticket={ticketForCard} 
                      basePath="/admin/dashboard" 
                    />
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
