import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

// Data loading
import { getCachedUser } from "@/lib/cache/cached-queries";
import { getCategoriesHierarchy } from "@/lib/category/getCategoriesHierarchy";
import { getCachedTicketStatuses } from "@/lib/cache/cached-queries";
import { getStudentTickets, getTicketStats } from "@/lib/tickets/queries";
import { sanitizeTicket, sanitizeCategoryHierarchy } from "@/lib/tickets/serialization";

// UI Components
import { DashboardHeader } from "@/components/student/dashboard/DashboardHeader";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { TicketSearchWrapper } from "@/components/student/TicketSearchWrapper";
import { TicketList } from "@/components/student/dashboard/TicketList";
import { TicketEmpty } from "@/components/student/dashboard/TicketEmpty";
import { PaginationControls } from "@/components/dashboard/PaginationControls";

// Force dynamic rendering for authenticated routes
export const dynamic = 'force-dynamic';
// Cache response for 30 seconds to improve performance
export const revalidate = 30;

export default async function StudentDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  try {
    // -----------------------------
    // 1. Get DB User
    // Note: Auth is handled by student/layout.tsx
    // Layout ensures userId exists and user is created via getOrCreateUser
    // -----------------------------
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized"); // TypeScript type guard - layout ensures this never happens
    const dbUser = await getCachedUser(userId);

    // -----------------------------
    // 2. Parse URL params
    // -----------------------------
    const params = (await searchParams) ?? {};
    const search = params.search ?? "";
    const statusFilter = params.status ?? "";
    const escalatedFilter = params.escalated ?? "";
    const categoryFilter = params.category ?? "";
    const subcategoryFilter = params.subcategory ?? "";
    const sortBy = params.sort ?? "newest";
    const page = parseInt(params.page || "1", 10);

    // Build dynamic filters from params
    const safeParams = params && typeof params === 'object' && !Array.isArray(params) ? params : {};
    const dynamicFilters = Object.entries(safeParams)
      .filter(([key]) => key.startsWith("f_"))
      .map(([key, value]) => ({ key, value: value || "" }))
      .filter((f) => f.value);

    // -----------------------------
    // 3. Load all data in parallel
    // -----------------------------
    const [ticketsResult, stats, categoryListResult, ticketStatusesResult] = await Promise.all([
      getStudentTickets({
        userId: dbUser.id,
        search,
        status: statusFilter,
        escalated: escalatedFilter,
        category: categoryFilter,
        subcategory: subcategoryFilter,
        dynamicFilters,
        sortBy,
        page,
        limit: 12,
      }),
      getTicketStats(dbUser.id),
      getCategoriesHierarchy().catch(() => []),
      getCachedTicketStatuses().catch(() => []),
    ]);

    // -----------------------------
    // 4. Sanitize and serialize data
    // -----------------------------
    const allTickets = ticketsResult.tickets
      .map(sanitizeTicket)
      .filter((ticket): ticket is NonNullable<typeof ticket> => ticket !== null);

    const categoryList = sanitizeCategoryHierarchy(
      Array.isArray(categoryListResult) ? categoryListResult : []
    );

    const ticketStatuses = Array.isArray(ticketStatusesResult)
      ? ticketStatusesResult.map((status) => {
          if (!status || typeof status !== 'object') return null;
          return {
            id: (status as { id?: number }).id ?? 0,
            value: (status as { value?: string }).value ?? '',
            label: (status as { label?: string }).label ?? '',
            description: (status as { description?: string | null }).description ?? null,
            progress_percent: (status as { progress_percent?: number }).progress_percent ?? 0,
            badge_color: (status as { badge_color?: string | null }).badge_color ?? null,
            is_active: (status as { is_active?: boolean }).is_active ?? true,
            is_final: (status as { is_final?: boolean }).is_final ?? false,
            display_order: (status as { display_order?: number }).display_order ?? 0,
          };
        }).filter((s): s is NonNullable<typeof s> => s !== null)
      : [];

    // Test serialization before rendering to catch any issues early
    try {
      JSON.stringify({
        allTickets,
        categoryList,
        ticketStatuses,
        stats,
        pagination: ticketsResult.pagination,
        sortBy,
      });
    } catch (serializationError) {
      console.error('[StudentDashboardPage] Serialization error:', serializationError);
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-destructive">Data Error</h2>
            <p className="text-muted-foreground">
              There was an error preparing the dashboard data. Please try refreshing the page.
            </p>
          </div>
        </div>
      );
    }

    // -----------------------------
    // 5. UI Render
    // -----------------------------
    return (
      <div className="space-y-4 sm:space-y-6 lg:space-y-8">
        {/* Header */}
        <DashboardHeader />

        {/* Alert for tickets awaiting student response */}
        {stats.awaitingStudent > 0 && (
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertTitle className="text-amber-900 dark:text-amber-100">
              Action Required: {stats.awaitingStudent} Ticket{stats.awaitingStudent !== 1 ? 's' : ''} Awaiting Your Response
            </AlertTitle>
            <AlertDescription className="text-amber-800 dark:text-amber-200 mt-1">
              You have {stats.awaitingStudent} ticket{stats.awaitingStudent !== 1 ? 's' : ''} that {stats.awaitingStudent !== 1 ? 'require' : 'requires'} your response. Please review and respond to help resolve these tickets.
            </AlertDescription>
          </Alert>
        )}

        {/* Stats */}
        {stats.total > 0 && (
          <Suspense fallback={<div className="h-32 animate-pulse bg-muted rounded-lg" />}>
            <StatsCards stats={stats} />
          </Suspense>
        )}

        {/* Search + Filters */}
        <Card className="border-2">
          <CardContent className="p-4 sm:p-6">
            <Suspense fallback={<div className="h-20 animate-pulse bg-muted rounded-lg" />}>
              <TicketSearchWrapper
                categories={categoryList}
                currentSort={sortBy}
                statuses={ticketStatuses}
              />
            </Suspense>
          </CardContent>
        </Card>

        {/* Tickets List or Empty State */}
        {allTickets.length === 0 ? (
          <TicketEmpty />
        ) : (
          <>
            <TicketList tickets={allTickets} />
            
            {/* Pagination */}
            {ticketsResult.pagination.totalPages > 1 && (
              <PaginationControls
                currentPage={ticketsResult.pagination.currentPage}
                totalPages={ticketsResult.pagination.totalPages}
                hasNext={ticketsResult.pagination.hasNextPage}
                hasPrev={ticketsResult.pagination.hasPrevPage}
                totalCount={ticketsResult.pagination.totalCount}
                startIndex={ticketsResult.pagination.startIndex}
                endIndex={ticketsResult.pagination.endIndex}
              />
            )}
          </>
        )}
      </div>
    );
  } catch (error) {
    console.error('[StudentDashboardPage] Error:', error);
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-destructive">Error Loading Dashboard</h2>
          <p className="text-muted-foreground">
            There was an error loading your dashboard. Please try refreshing the page.
          </p>
        </div>
      </div>
    );
  }
}
