import { auth } from "@clerk/nextjs/server";
import { db, tickets, users, categories, subcategories, sub_subcategories, ticket_statuses } from "@/db";
import { eq, ilike, and, or, sql, asc, desc } from "drizzle-orm";

import { Suspense } from "react";
import { TicketCard } from "@/components/layout/TicketCard";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, AlertCircle } from "lucide-react";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { getCachedUser } from "@/lib/cache/cached-queries";
import { TicketSearchWrapper } from "@/components/student/TicketSearchWrapper";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getCategoriesHierarchy } from "@/lib/category/getCategoriesHierarchy";
import { getCachedTicketStatuses } from "@/lib/cache/cached-queries";
import { getCanonicalStatus } from "@/conf/constants";
import { PaginationControls } from "@/components/dashboard/PaginationControls";
import type { Ticket } from "@/db/types-only";

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
    // Use cached function for better performance (request-scoped deduplication)
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
  const subSubcategoryFilter = params.sub_subcategory ?? "";
  const sortBy = params.sort ?? "newest";

  // -----------------------------
  // 3. Build SQL conditions
  // -----------------------------
  const conditions = [eq(tickets.created_by, dbUser.id)];

  // Search
  if (search) {
    const value = `%${search}%`;
    const searchConditions = [
      ilike(tickets.description, value),
      ilike(categories.name, value),
      sql`tickets.id::text ILIKE ${value}`,
    ].filter(Boolean);

    if (searchConditions.length > 0) {
      conditions.push(or(...searchConditions)!);
    }
  }

  // Escalated Filter (check this before status filter to avoid conflicts)
  if (escalatedFilter === "true") {
    conditions.push(sql`${tickets.escalation_level} > 0`);
  }

  // Status Filter
  if (statusFilter) {
    const canonical = (getCanonicalStatus(statusFilter) ?? statusFilter.toLowerCase()).toLowerCase();

    if (canonical === "escalated") {
      conditions.push(sql`${tickets.escalation_level} > 0`);
    } else if (canonical) {
      // Join ticket_statuses for status filtering
      conditions.push(sql`EXISTS (
        SELECT 1 FROM ticket_statuses ts 
        WHERE ts.id = ${tickets.status_id} 
        AND LOWER(ts.value) = ${canonical}
      )`);
    }
  }

  // Category Filter (slug-based)
  if (categoryFilter) {
    conditions.push(ilike(categories.slug, categoryFilter.toLowerCase()));
  }

  // Subcategory and Sub-subcategory Filters - fetch in parallel
  const [subcategoryResult, subSubcategoryResult] = await Promise.all([
    subcategoryFilter
      ? db
          .select({ id: subcategories.id })
          .from(subcategories)
          .where(eq(subcategories.slug, subcategoryFilter))
          .limit(1)
      : Promise.resolve([]),
    subSubcategoryFilter
      ? db
          .select({ id: sub_subcategories.id })
          .from(sub_subcategories)
          .where(eq(sub_subcategories.slug, subSubcategoryFilter))
          .limit(1)
      : Promise.resolve([]),
  ]);

  if (subcategoryResult.length > 0) {
    conditions.push(sql`metadata->>'subcategoryId' = ${String(subcategoryResult[0].id)}`);
  }

  if (subSubcategoryResult.length > 0) {
    conditions.push(sql`metadata->>'subSubcategoryId' = ${String(subSubcategoryResult[0].id)}`);
  }

  // Dynamic Field Filters (f_ prefix)
  // Safety check: ensure params is a valid object before calling Object.entries
  const safeParams = params && typeof params === 'object' && !Array.isArray(params) ? params : {};
  const dynamicFilters = Object.entries(safeParams).filter(([key]) => key.startsWith("f_"));

  for (const [key, value] of dynamicFilters) {
    if (typeof value === 'string' && value) {
      const fieldSlug = key.replace("f_", "");
      // Query: metadata->'dynamic_fields'->fieldSlug->>'value' = value
      // We use sql injection safe parameterization
      conditions.push(sql`metadata->'dynamic_fields'->${fieldSlug}->>'value' = ${value}`);
    }
  }

  // -----------------------------
  // 4. SQL Sorting
  // -----------------------------
  let orderBy: ReturnType<typeof desc> | ReturnType<typeof asc> | undefined;

  switch (sortBy) {
    case "oldest":
      orderBy = asc(tickets.created_at);
      break;

    case "due-date":
      orderBy = asc(tickets.resolution_due_at);
      break;

    case "status":
      // Use joined ticket_statuses for status-based sorting (no subquery needed)
      // Closed and resolved should appear at the bottom (higher numbers)
      orderBy = sql`
        CASE 
          WHEN LOWER(${ticket_statuses.value}) = 'open' THEN 1
          WHEN LOWER(${ticket_statuses.value}) = 'in_progress' THEN 2
          WHEN LOWER(${ticket_statuses.value}) = 'awaiting_student' THEN 3
          WHEN LOWER(${ticket_statuses.value}) = 'reopened' THEN 4
          WHEN LOWER(${ticket_statuses.value}) = 'escalated' THEN 5
          WHEN LOWER(${ticket_statuses.value}) = 'forwarded' THEN 6
          WHEN LOWER(${ticket_statuses.value}) = 'resolved' THEN 8
          WHEN LOWER(${ticket_statuses.value}) = 'closed' THEN 9
          ELSE 999
        END
      `;
      break;

    default:
      // Sort by status priority first (active tickets first, closed/resolved last)
      // Then by updated_at desc to show recently updated tickets at the top
      // Fallback to created_at if updated_at is null
      orderBy = sql`
        CASE 
          WHEN LOWER(${ticket_statuses.value}) IN ('closed', 'resolved') THEN 1
          ELSE 0
        END,
        COALESCE(${tickets.updated_at}, ${tickets.created_at}) DESC
      `;
  }

  // -----------------------------
  // 5. Pagination setup
  // -----------------------------
  const page = parseInt(params.page || "1", 10);
  const limit = 12; // Tickets per page
  const offset = (page - 1) * limit;
  
  // -----------------------------
  // 6. Parallelize all data fetching for better performance
  // -----------------------------
  
  // Run all queries in parallel for maximum performance
  const [allTicketsRaw, countResult, statsResult, categoryListResult, ticketStatusesResult] = await Promise.all([
    // Fetch Filtered Tickets
    db
      .select({
        id: tickets.id,
        title: tickets.title,
        description: tickets.description,
        location: tickets.location,
        status_id: tickets.status_id,
        status: ticket_statuses.value,
        category_id: tickets.category_id,
        subcategory_id: tickets.subcategory_id,
        sub_subcategory_id: tickets.sub_subcategory_id,
        scope_id: tickets.scope_id,
        created_by: tickets.created_by,
        assigned_to: tickets.assigned_to,
        escalation_level: tickets.escalation_level,
        acknowledgement_due_at: tickets.acknowledgement_due_at,
        resolution_due_at: tickets.resolution_due_at,
        metadata: tickets.metadata,
        created_at: tickets.created_at,
        updated_at: tickets.updated_at,
        category_name: categories.name,
        creator_full_name: users.full_name,
        creator_email: users.email,
      })
      .from(tickets)
      .leftJoin(categories, eq(tickets.category_id, categories.id))
      .leftJoin(users, eq(tickets.created_by, users.id))
      .leftJoin(ticket_statuses, eq(ticket_statuses.id, tickets.status_id))
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    
    // Count total tickets for pagination
    db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(tickets)
      .leftJoin(categories, eq(tickets.category_id, categories.id))
      .leftJoin(users, eq(tickets.created_by, users.id))
      .where(and(...conditions)),
    
    // Stats Query (Optimized with JOIN instead of subqueries)
    db
      .select({
        total: sql<number>`COUNT(*)`,
        open: sql<number>`SUM(CASE WHEN LOWER(${ticket_statuses.value})='open' THEN 1 ELSE 0 END)`,
        inProgress: sql<number>`SUM(CASE WHEN LOWER(${ticket_statuses.value}) IN ('in_progress','escalated') THEN 1 ELSE 0 END)`,
        awaitingStudent: sql<number>`SUM(CASE WHEN LOWER(${ticket_statuses.value})='awaiting_student' THEN 1 ELSE 0 END)`,
        reopened: sql<number>`SUM(CASE WHEN LOWER(${ticket_statuses.value})='reopened' THEN 1 ELSE 0 END)`,
        resolved: sql<number>`SUM(CASE WHEN LOWER(${ticket_statuses.value})='resolved' THEN 1 ELSE 0 END)`,
        closed: sql<number>`SUM(CASE WHEN LOWER(${ticket_statuses.value})='closed' THEN 1 ELSE 0 END)`,
        escalated: sql<number>`SUM(CASE WHEN ${tickets.escalation_level} > 0 THEN 1 ELSE 0 END)`,
      })
      .from(tickets)
      .leftJoin(ticket_statuses, eq(ticket_statuses.id, tickets.status_id))
      .where(eq(tickets.created_by, dbUser.id)),
    
    // Fetch categories hierarchy and statuses for search UI
    getCategoriesHierarchy().catch(() => []),
    getCachedTicketStatuses().catch(() => []),
  ]);
  
  // Helper function to recursively sanitize objects for serialization
  const sanitizeForSerialization = (obj: unknown): unknown => {
    if (obj === null || obj === undefined) {
      return null;
    }
    if (typeof obj !== 'object') {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitizeForSerialization).filter((item) => item !== undefined);
    }
    const sanitized: Record<string, unknown> = {};
    const objRecord = obj as Record<string, unknown>;
    for (const key in objRecord) {
      if (Object.prototype.hasOwnProperty.call(objRecord, key)) {
        const value = objRecord[key];
        if (value !== undefined) {
          sanitized[key] = sanitizeForSerialization(value);
        }
      }
    }
    return sanitized;
  };

  // Ensure categoryList and ticketStatuses are arrays (safety check)
  // Also ensure they are properly serializable (no undefined/null values in nested objects)
  const categoryList = Array.isArray(categoryListResult) 
    ? categoryListResult.map((cat) => {
        if (!cat || typeof cat !== 'object') return null;
        const sanitized = sanitizeForSerialization({
          value: cat.value ?? '',
          label: cat.label ?? '',
          id: cat.id ?? 0,
          subcategories: Array.isArray(cat.subcategories) 
            ? cat.subcategories.map((sub) => ({
                value: sub.value ?? '',
                label: sub.label ?? '',
                id: sub.id ?? 0,
                sub_subcategories: Array.isArray(sub.sub_subcategories)
                  ? sub.sub_subcategories.map((ss) => ({
                      value: ss.value ?? '',
                      label: ss.label ?? '',
                      id: ss.id ?? 0,
                    }))
                  : [],
                fields: Array.isArray(sub.fields)
                  ? sub.fields.map((f) => ({
                      id: f.id ?? 0,
                      name: f.name ?? '',
                      slug: f.slug ?? '',
                      type: f.type ?? 'text',
                      options: Array.isArray(f.options)
                        ? f.options.map((o) => ({
                            label: o.label ?? '',
                            value: o.value ?? '',
                          }))
                        : [],
                    }))
                  : [],
              }))
            : [],
        });
        return sanitized;
      }).filter(Boolean) as Array<{ value: string; label: string; id: number; subcategories: Array<{ value: string; label: string; id: number; sub_subcategories: Array<{ value: string; label: string; id: number }>; fields: Array<{ id: number; name: string; slug: string; type: string; options: Array<{ label: string; value: string }> }> }> }>
    : [];
  
  const ticketStatuses = Array.isArray(ticketStatusesResult)
    ? ticketStatusesResult.map((status) => {
        if (!status || typeof status !== 'object') return null;
        return sanitizeForSerialization({
          id: status.id ?? 0,
          value: status.value ?? '',
          label: status.label ?? '',
          description: status.description ?? null,
          progress_percent: status.progress_percent ?? 0,
          badge_color: status.badge_color ?? null,
          is_active: status.is_active ?? true,
          is_final: status.is_final ?? false,
          display_order: status.display_order ?? 0,
        });
      }).filter(Boolean) as Array<{ id: number; value: string; label: string; description: string | null; progress_percent: number; badge_color: string | null; is_active: boolean; is_final: boolean; display_order: number }>
    : [];
  
  // Convert Date objects to ISO strings for serialization
  const serializeDate = (date: Date | string | null | undefined): string | null => {
    if (!date) return null;
    if (date instanceof Date) {
      return date.toISOString();
    }
    if (typeof date === 'string') {
      return date;
    }
    return null;
  };

  const allTickets = (Array.isArray(allTicketsRaw) ? allTicketsRaw : []).map((ticket) => {
    // Ensure ticket is a valid object
    if (!ticket || typeof ticket !== 'object') {
      return null;
    }
    
    // Ensure metadata is a valid object (not null/undefined)
    let safeMetadata: Record<string, unknown> = {};
    try {
      if (ticket.metadata !== null && ticket.metadata !== undefined) {
        if (typeof ticket.metadata === 'object') {
          // Deep clone and ensure all values are serializable
          safeMetadata = JSON.parse(JSON.stringify(ticket.metadata));
        }
      }
    } catch {
      // If metadata can't be serialized, use empty object
      safeMetadata = {};
    }
    
    return {
      id: ticket.id ?? null,
      title: ticket.title ?? null,
      description: ticket.description ?? null,
      location: ticket.location ?? null,
      status_id: ticket.status_id ?? null,
      status: ticket.status ?? null,
      category_id: ticket.category_id ?? null,
      subcategory_id: ticket.subcategory_id ?? null,
      sub_subcategory_id: ticket.sub_subcategory_id ?? null,
      scope_id: ticket.scope_id ?? null,
      created_by: ticket.created_by ?? null,
      assigned_to: ticket.assigned_to ?? null,
      escalation_level: Number(ticket.escalation_level) || 0,
      acknowledgement_due_at: serializeDate(ticket.acknowledgement_due_at),
      resolution_due_at: serializeDate(ticket.resolution_due_at),
      metadata: safeMetadata,
      created_at: serializeDate(ticket.created_at),
      updated_at: serializeDate(ticket.updated_at),
      category_name: ticket.category_name ?? null,
      creator_name: ticket.creator_full_name ?? null,
      creator_email: ticket.creator_email ?? null,
    };
  }).filter((ticket): ticket is NonNullable<typeof ticket> => ticket !== null); // Remove any null entries

  // Pagination calculations
  const totalCount = Number(countResult[0]?.count || 0);
  const totalPages = Math.ceil(totalCount / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;
  const startIndex = totalCount > 0 ? offset + 1 : 0;
  const endIndex = Math.min(offset + allTickets.length, totalCount);

  // Ensure stats values are numbers with safe defaults
  const safeStats = {
    total: Number(statsResult[0]?.total) || 0,
    open: Number(statsResult[0]?.open) || 0,
    inProgress: Number(statsResult[0]?.inProgress) || 0,
    awaitingStudent: Number(statsResult[0]?.awaitingStudent) || 0,
    reopened: Number(statsResult[0]?.reopened) || 0,
    resolved: Number(statsResult[0]?.resolved) || 0,
    closed: Number(statsResult[0]?.closed) || 0,
    escalated: Number(statsResult[0]?.escalated) || 0,
  };

  // Test serialization before rendering to catch any issues early
  try {
    JSON.stringify({
      allTickets,
      categoryList,
      ticketStatuses,
      safeStats,
      totalCount,
      totalPages,
      hasNextPage,
      hasPrevPage,
      startIndex,
      endIndex,
      sortBy,
    });
  } catch (serializationError) {
    console.error('[StudentDashboardPage] Serialization error:', serializationError);
    // Return error UI if serialization fails
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
  // 7. UI Render
  // -----------------------------
  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            My Tickets
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
            Manage and track all your support tickets
          </p>
        </div>
        <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
          <Link href="/student/dashboard/ticket/new" className="flex-1 sm:flex-initial">
            <Button className="w-full sm:w-auto shadow-md hover:shadow-lg transition-shadow text-sm sm:text-base">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">New Ticket</span>
              <span className="sm:hidden">New</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Alert for tickets awaiting student response */}
      {safeStats && typeof safeStats === 'object' && 'awaitingStudent' in safeStats && Number(safeStats.awaitingStudent) > 0 && (
        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-amber-900 dark:text-amber-100">
            Action Required: {Number(safeStats.awaitingStudent)} Ticket{Number(safeStats.awaitingStudent) !== 1 ? 's' : ''} Awaiting Your Response
          </AlertTitle>
          <AlertDescription className="text-amber-800 dark:text-amber-200 mt-1">
            You have {Number(safeStats.awaitingStudent)} ticket{Number(safeStats.awaitingStudent) !== 1 ? 's' : ''} that {Number(safeStats.awaitingStudent) !== 1 ? 'require' : 'requires'} your response. Please review and respond to help resolve these tickets.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      {safeStats && typeof safeStats === 'object' && 'total' in safeStats && safeStats.total > 0 && (
        <Suspense fallback={<div className="h-32 animate-pulse bg-muted rounded-lg" />}>
          <StatsCards stats={safeStats} />
        </Suspense>
      )}

      {/* Search + Filters */}
      <Card className="border-2">
        <CardContent className="p-4 sm:p-6">
          <Suspense fallback={<div className="h-20 animate-pulse bg-muted rounded-lg" />}>
            <TicketSearchWrapper
              categories={categoryList}
              currentSort={sortBy || 'newest'}
              statuses={ticketStatuses}
            />
          </Suspense>
        </CardContent>
      </Card>

      {/* No Tickets */}
      {allTickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-4 border-2 border-dashed rounded-lg bg-muted/30">
          <div className="text-center space-y-3 max-w-sm">
            <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
              <Plus className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold">No tickets yet</h3>
            <p className="text-sm sm:text-base text-muted-foreground">
              Get started by creating your first support ticket. We&apos;re here to
              help!
            </p>
            <Link
              href="/student/dashboard/ticket/new"
              className="inline-block mt-4"
            >
              <Button className="text-sm sm:text-base">
                <Plus className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Create Your First Ticket</span>
                <span className="sm:hidden">Create Ticket</span>
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            {allTickets.map((ticket) => (
              <TicketCard 
                key={ticket.id} 
                ticket={ticket as unknown as Ticket & { status?: string | null; category_name?: string | null; creator_name?: string | null; creator_email?: string | null }} 
              />
            ))}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <PaginationControls
              currentPage={page}
              totalPages={totalPages}
              hasNext={hasNextPage}
              hasPrev={hasPrevPage}
              totalCount={totalCount}
              startIndex={startIndex}
              endIndex={endIndex}
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
