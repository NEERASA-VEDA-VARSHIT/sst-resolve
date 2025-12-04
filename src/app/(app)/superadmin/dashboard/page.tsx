import { auth } from "@clerk/nextjs/server";
import { db, tickets, categories, users, ticket_statuses } from "@/db";

import { desc, eq, isNull, or, sql, count, inArray } from "drizzle-orm";

import type { Ticket } from "@/db/types-only";

import type { TicketMetadata } from "@/db/inferred-types";

import { TicketCard } from "@/components/layout/TicketCard";

import { Card, CardContent } from "@/components/ui/card";

import { AdminTicketFilters } from "@/components/admin/AdminTicketFilters";

import { FileText } from "lucide-react";

import { StatsCards } from "@/components/dashboard/StatsCards";

import { PaginationControls } from "@/components/dashboard/PaginationControls";

import { getCachedAdminUser } from "@/lib/cache/cached-queries";

import { normalizeStatusForComparison } from "@/lib/utils";

// Force dynamic rendering for authenticated routes
export const dynamic = 'force-dynamic';
// Cache response for 30 seconds to improve performance
export const revalidate = 30;



/**
 * Super Admin Dashboard Page
 * Note: Auth and role checks are handled by superadmin/layout.tsx
 */
export default async function SuperAdminDashboardPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  // Layout ensures userId exists and user is a super_admin
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized"); // TypeScript type guard - layout ensures this never happens

  // Use cached functions for better performance
  // Layout already ensures user exists via getOrCreateUser, so dbUser will exist
  const { dbUser } = await getCachedAdminUser(userId);



  const resolvedSearchParams = searchParams ? await searchParams : {};

  const params = resolvedSearchParams || {};

  const tat = (typeof params["tat"] === "string" ? params["tat"] : params["tat"]?.[0]) || "";

  const statusFilter = (typeof params["status"] === "string" ? params["status"] : params["status"]?.[0]) || "";

  const escalatedFilter = (typeof params["escalated"] === "string" ? params["escalated"] : params["escalated"]?.[0]) || "";

  const createdFrom = (typeof params["from"] === "string" ? params["from"] : params["from"]?.[0]) || "";

  const createdTo = (typeof params["to"] === "string" ? params["to"] : params["to"]?.[0]) || "";

  const user = (typeof params["user"] === "string" ? params["user"] : params["user"]?.[0]) || "";

  const sort = (typeof params["sort"] === "string" ? params["sort"] : params["sort"]?.[0]) || "newest";



  // Pagination

  const page = parseInt((typeof params["page"] === "string" ? params["page"] : params["page"]?.[0]) || "1", 10);

  const limit = 20; // Tickets per page

  const offsetValue = (page - 1) * limit;



  // Define where conditions for reuse

  // Super admin sees: unassigned tickets, tickets assigned to them, and escalated tickets

  const whereConditions = or(

    isNull(tickets.assigned_to), // Unassigned tickets

    dbUser ? eq(tickets.assigned_to, dbUser.id) : sql`false`, // Assigned to super admin

    sql`${tickets.escalation_level} > 0` // Escalated tickets

  );



  // Get total count of tickets matching the conditions (for pagination)

  let totalCount = 0;

  type TicketRowRaw = {

    id: number;

    title: string | null;

    description: string | null;

    location: string | null;

    status: string | null;

    status_id: number | null;

    category_id: number | null;

    subcategory_id: number | null;


    created_by: string | null;

    assigned_to: string | null;

    group_id: number | null;

    escalation_level: number | null;

    acknowledgement_due_at: Date | null;

    resolution_due_at: Date | null;

    metadata: unknown;

    created_at: Date | null;

    updated_at: Date | null;

    category_name: string | null;

    creator_full_name: string | null;

    creator_email: string | null;

  };

  type TicketRow = TicketRowRaw & {

    status_id: number | null;

    scope_id: number | null;

    rating: number | null;

    feedback_type: string | null;

    rating_submitted: Date | null;

    feedback: string | null;

    admin_link: string | null;

    student_link: string | null;

    slack_thread_id: string | null;

    external_ref: string | null;

    creator_name: string | null;

    assigned_staff_name?: string | null;

    assigned_staff_email?: string | null;

  };

  let ticketRows: TicketRow[] = [];

  try {

    const [totalResultArray, ticketRowsRawResult] = await Promise.all([

      db

        .select({ count: count() })

        .from(tickets)

        .where(whereConditions),

      db

        .select({

          id: tickets.id,

          title: tickets.title,

          description: tickets.description,

          location: tickets.location,

          status: ticket_statuses.value,

          status_id: tickets.status_id,

          category_id: tickets.category_id,

          subcategory_id: tickets.subcategory_id,


          created_by: tickets.created_by,

          assigned_to: tickets.assigned_to,

          group_id: tickets.group_id,

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

        .leftJoin(ticket_statuses, eq(ticket_statuses.id, tickets.status_id))

        .leftJoin(categories, eq(tickets.category_id, categories.id))

        .leftJoin(users, eq(tickets.created_by, users.id))

        .where(whereConditions)

        .orderBy(desc(tickets.created_at))

        .limit(limit)

        .offset(offsetValue),

    ]);



    const ticketRowsRaw = Array.isArray(ticketRowsRawResult) ? ticketRowsRawResult : [];

    const [totalResult] = Array.isArray(totalResultArray) ? totalResultArray : [];

    totalCount = totalResult?.count || 0;



    const assignedToIds = [

      ...new Set(

        ticketRowsRaw

          .map((t) => t.assigned_to)

          .filter((value): value is string => typeof value === "string" && value.length > 0)

      ),

    ];

    type AdminInfo = {

      id: string;

      full_name: string | null;

      email: string;

    };

    let assignedAdmins: Record<string, AdminInfo> = {};



    if (assignedToIds.length > 0) {

      try {

        const admins = await db

          .select({

            id: users.id,

            full_name: users.full_name,

            email: users.email,

          })

          .from(users)

          .where(inArray(users.id, assignedToIds));



        const safeAdmins = (Array.isArray(admins) ? admins : []).filter(

          (admin): admin is AdminInfo & { id: string } =>

            typeof admin.id === "string" && admin.id.length > 0

        );



        if (safeAdmins.length > 0) {

          try {

            assignedAdmins = Object.fromEntries(

              safeAdmins.map((admin) => [

                admin.id,

                {

                  id: admin.id,

                  full_name: admin.full_name || null,

                  email: admin.email,

                },

              ])

            );

          } catch (fromEntriesError) {

            console.error("[Super Admin Dashboard] Error creating assignedAdmins map:", fromEntriesError);

            assignedAdmins = {};

          }

        }

      } catch (adminError) {

        console.error("[Super Admin Dashboard] Failed to load assigned admin info:", adminError);

        assignedAdmins = {};

      }

    }



    ticketRows = ticketRowsRaw.map((row) => {

      // Extract metadata fields

      let ticketMetadata: TicketMetadata = {};

      if (row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)) {

        ticketMetadata = row.metadata as TicketMetadata;

      }

      return {

        ...row,

        status_id: row.status_id || null,

        scope_id: null,

        created_by: row.created_by || "",

        created_at: row.created_at || new Date(),

        updated_at: row.updated_at || new Date(),

        escalation_level: row.escalation_level || 0,

        rating: (ticketMetadata.rating as number | null) || null,

        feedback_type: (ticketMetadata.feedback_type as string | null) || null,

        rating_submitted: ticketMetadata.rating_submitted ? new Date(ticketMetadata.rating_submitted) : null,

        feedback: (ticketMetadata.feedback as string | null) || null,

        admin_link: null,

        student_link: null,

        slack_thread_id: null,

        external_ref: null,

        creator_name: row.creator_full_name || null,

        assigned_staff_name: row.assigned_to ? assignedAdmins[row.assigned_to]?.full_name || null : null,

        assigned_staff_email: row.assigned_to ? assignedAdmins[row.assigned_to]?.email ?? null : null,

      };

    });

  } catch (error) {

    console.error("[Super Admin Dashboard] Error fetching tickets/count:", error);

    // Log more details about the error

    if (error instanceof Error) {

      console.error("[Super Admin Dashboard] Error message:", error.message);

      console.error("[Super Admin Dashboard] Error stack:", error.stack);

    }

    // Don't throw - return empty state instead to prevent page crash

    ticketRows = [];

    totalCount = 0;

  }



  // Apply additional client-side filters not handled by API

  let filteredTickets = ticketRows;



  // Filter by escalated tickets (escalation_level > 0)

  if (escalatedFilter === "true") {

    filteredTickets = filteredTickets.filter((t) => (t.escalation_level || 0) > 0);

  }



  if (user) {

    filteredTickets = filteredTickets.filter((t) => {

      const name = (t.creator_name || "").toLowerCase();

      const email = (t.creator_email || "").toLowerCase();

      return name.includes(user.toLowerCase()) || email.includes(user.toLowerCase());

    });

  }



  if (createdFrom) {

    const from = new Date(createdFrom);

    from.setHours(0, 0, 0, 0);

    filteredTickets = filteredTickets.filter((t) => t.created_at && t.created_at.getTime() >= from.getTime());

  }



  if (createdTo) {

    const to = new Date(createdTo);

    to.setHours(23, 59, 59, 999);

    filteredTickets = filteredTickets.filter((t) => t.created_at && t.created_at.getTime() <= to.getTime());

  }



  if (statusFilter) {

    const normalizedFilter = statusFilter.toLowerCase();

    filteredTickets = filteredTickets.filter((ticket) => {

      const normalizedTicketStatus = normalizeStatusForComparison(ticket.status);

      if (normalizedFilter === "awaiting_student_response") {

        return normalizedTicketStatus === "awaiting_student_response" || normalizedTicketStatus === "awaiting_student";

      }

      return normalizedTicketStatus === normalizedFilter;

    });

  }



  if (tat) {

    const now = new Date();

    const startOfToday = new Date(now);

    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date(now);

    endOfToday.setHours(23, 59, 59, 999);

    filteredTickets = filteredTickets.filter((t) => {

      const metadata = (t.metadata as TicketMetadata) || {};

      const tatDate = t.resolution_due_at || (metadata?.tatDate && typeof metadata.tatDate === "string" ? new Date(metadata.tatDate) : null);

      const hasTat = !!tatDate;



      if (tat === "has") return hasTat;

      if (tat === "none") return !hasTat;

      if (tat === "due") return hasTat && tatDate && tatDate.getTime() < now.getTime();

      if (tat === "upcoming") return hasTat && tatDate && tatDate.getTime() >= now.getTime();

      if (tat === "today") {

        return hasTat && tatDate && tatDate.getTime() >= startOfToday.getTime() && tatDate.getTime() <= endOfToday.getTime();

      }

      return true;

    });

  }



  // Apply sorting

  filteredTickets.sort((a, b) => {

    switch (sort) {

      case "newest":

        return (b.created_at?.getTime() || 0) - (a.created_at?.getTime() || 0);

      case "oldest":

        return (a.created_at?.getTime() || 0) - (b.created_at?.getTime() || 0);

      case "status":

        const statusOrder = {

          OPEN: 1, IN_PROGRESS: 2, AWAITING_STUDENT: 3,

          REOPENED: 4, ESCALATED: 5, RESOLVED: 6,

        };

        const aStatus = statusOrder[a.status as keyof typeof statusOrder] || 99;

        const bStatus = statusOrder[b.status as keyof typeof statusOrder] || 99;

        if (aStatus !== bStatus) return aStatus - bStatus;

        return (b.created_at?.getTime() || 0) - (a.created_at?.getTime() || 0);

      case "due-date":

        const aDue = a.resolution_due_at?.getTime() || Infinity;

        const bDue = b.resolution_due_at?.getTime() || Infinity;

        if (aDue !== bDue) return aDue - bDue;

        return (b.created_at?.getTime() || 0) - (a.created_at?.getTime() || 0);

      default:

        return (b.created_at?.getTime() || 0) - (a.created_at?.getTime() || 0);

    }

  });



  const allTickets = filteredTickets;



  // Calculate pagination metadata

  const actualCount = allTickets.length;

  const totalPages = Math.ceil(totalCount / limit);

  const hasNextPage = page < totalPages;

  const hasPrevPage = page > 1;

  const startIndex = offsetValue + 1;

  const endIndex = Math.min(offsetValue + actualCount, totalCount);



  const pagination = {

    page,

    totalPages,

    hasNextPage,

    hasPrevPage,

    totalCount,

    startIndex,

    endIndex,

    actualCount, // Add actual filtered count

  };



  const stats = {

    total: allTickets.length,

    open: allTickets.filter((t) => {

      const normalized = normalizeStatusForComparison(t.status);

      return normalized === "open";

    }).length,

    inProgress: allTickets.filter((t) => {

      const normalized = normalizeStatusForComparison(t.status);

      // Include both IN_PROGRESS and ESCALATED status as "in progress"

      return normalized === "in_progress" || normalized === "escalated";

    }).length,

    awaitingStudent: allTickets.filter((t) => {

      const normalized = normalizeStatusForComparison(t.status);

      return normalized === "awaiting_student_response";

    }).length,

    resolved: allTickets.filter((t) => {

      const normalized = normalizeStatusForComparison(t.status);

      return normalized === "resolved" || normalized === "closed";

    }).length,

    escalated: allTickets.filter((t) => (t.escalation_level || 0) > 0).length,

  };



  // Calculate today pending count

  const now = new Date();

  const startOfToday = new Date(now);

  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date(now);

  endOfToday.setHours(23, 59, 59, 999);

  // Count unassigned tickets

  const unassignedCount = ticketRows.filter((t) => !t.assigned_to).length;



  return (

    <div className="space-y-8">

      <div>

        <div className="mb-6">
          <h1 className="text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Super Admin Dashboard
          </h1>
          <p className="text-muted-foreground">
            Manage unassigned tickets, escalations, and system-wide operations
          </p>
        </div>

        <div className="space-y-6">

          <StatsCards stats={stats} />



          <AdminTicketFilters />



          <div className="flex justify-between items-center pt-4">

            <h2 className="text-2xl font-semibold flex items-center gap-2">

              <FileText className="w-6 h-6" />

              Unassigned Tickets & Escalations

              {unassignedCount > 0 && (

                <span className="ml-2 px-2 py-1 text-xs rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium">

                  {unassignedCount} unassigned

                </span>

              )}

            </h2>

            <p className="text-sm text-muted-foreground">

              {pagination.actualCount} {pagination.actualCount === 1 ? 'ticket' : 'tickets'} on this page

              {pagination.totalPages > 1 && (

                <span className="ml-2">

                  (Page {pagination.page} of {pagination.totalPages})

                </span>

              )}

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

                  Unassigned tickets and escalations will appear here. Use the filters above to search for specific tickets.

                </p>

              </CardContent>

            </Card>

          ) : (

            <>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {allTickets.map((ticket) => (

                  <TicketCard

                    key={ticket.id}

                    ticket={{

                      ...ticket,

                      scope_id: null,

                      created_at: ticket.created_at || new Date(),

                      updated_at: ticket.updated_at || new Date(),

                    } as unknown as Ticket & { status?: string | null; category_name?: string | null; creator_name?: string | null; creator_email?: string | null }}

                    basePath="/superadmin/dashboard"

                  />

                ))}

              </div>



              {/* Pagination Controls */}

              <PaginationControls

                currentPage={pagination.page}

                totalPages={pagination.totalPages}

                hasNext={pagination.hasNextPage}

                hasPrev={pagination.hasPrevPage}

                totalCount={pagination.totalCount}

                startIndex={pagination.startIndex}

                endIndex={pagination.endIndex}

                baseUrl="/superadmin/dashboard"

              />

            </>

          )}

        </div>

      </div>

    </div>

  );

}

