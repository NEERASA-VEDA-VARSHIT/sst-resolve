import { db, tickets, categories, users, ticket_statuses } from "@/db";
import { desc, eq, isNull, or, sql, count, inArray } from "drizzle-orm";
import { getCachedAdminUser } from "@/lib/cache/cached-queries";
import { normalizeStatusForComparison } from "@/lib/utils";
import type { TicketMetadata } from "@/db/inferred-types";

export interface TicketRow {
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
  creator_name: string | null;
  creator_email: string | null;
  assigned_staff_name?: string | null;
  assigned_staff_email?: string | null;
}

export interface DashboardFilters {
  tat?: string;
  status?: string;
  escalated?: string;
  from?: string;
  to?: string;
  user?: string;
  sort?: string;
  page?: string;
}

export interface DashboardStats {
  total: number;
  open: number;
  inProgress: number;
  awaitingStudent: number;
  resolved: number;
  escalated: number;
}

export async function fetchSuperAdminTickets(
  userId: string,
  filters: DashboardFilters,
  limit: number = 20
) {
  const { dbUser } = await getCachedAdminUser(userId);

  const whereConditions = or(
    isNull(tickets.assigned_to),
    dbUser ? eq(tickets.assigned_to, dbUser.id) : sql`false`,
    sql`${tickets.escalation_level} > 0`
  );

  const page = parseInt(filters.page || "1", 10);
  const offsetValue = (page - 1) * limit;

  let totalCount = 0;
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
    if (error instanceof Error) {
      console.error("[Super Admin Dashboard] Error message:", error.message);
      console.error("[Super Admin Dashboard] Error stack:", error.stack);
    }
    ticketRows = [];
    totalCount = 0;
  }

  return { ticketRows, totalCount };
}

export function filterAndSortTickets(
  ticketRows: TicketRow[],
  filters: DashboardFilters
): TicketRow[] {
  let filteredTickets = ticketRows;

  // Filter by escalated tickets
  if (filters.escalated === "true") {
    filteredTickets = filteredTickets.filter((t) => (t.escalation_level || 0) > 0);
  }

  // Filter by user
  if (filters.user) {
    filteredTickets = filteredTickets.filter((t) => {
      const name = (t.creator_name || "").toLowerCase();
      const email = (t.creator_email || "").toLowerCase();
      return name.includes(filters.user!.toLowerCase()) || email.includes(filters.user!.toLowerCase());
    });
  }

  // Filter by date range
  if (filters.from) {
    const from = new Date(filters.from);
    from.setHours(0, 0, 0, 0);
    filteredTickets = filteredTickets.filter((t) => t.created_at && t.created_at.getTime() >= from.getTime());
  }

  if (filters.to) {
    const to = new Date(filters.to);
    to.setHours(23, 59, 59, 999);
    filteredTickets = filteredTickets.filter((t) => t.created_at && t.created_at.getTime() <= to.getTime());
  }

  // Filter by status
  if (filters.status) {
    const normalizedFilter = filters.status.toLowerCase();
    filteredTickets = filteredTickets.filter((ticket) => {
      const normalizedTicketStatus = normalizeStatusForComparison(ticket.status);
      if (normalizedFilter === "awaiting_student_response") {
        return normalizedTicketStatus === "awaiting_student_response" || normalizedTicketStatus === "awaiting_student";
      }
      return normalizedTicketStatus === normalizedFilter;
    });
  }

  // Filter by TAT
  if (filters.tat) {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    filteredTickets = filteredTickets.filter((t) => {
      const metadata = (t.metadata as TicketMetadata) || {};
      const tatDate = t.resolution_due_at || (metadata?.tatDate && typeof metadata.tatDate === "string" ? new Date(metadata.tatDate) : null);
      const hasTat = !!tatDate;

      if (filters.tat === "has") return hasTat;
      if (filters.tat === "none") return !hasTat;
      if (filters.tat === "due") return hasTat && tatDate && tatDate.getTime() < now.getTime();
      if (filters.tat === "upcoming") return hasTat && tatDate && tatDate.getTime() >= now.getTime();
      if (filters.tat === "today") {
        return hasTat && tatDate && tatDate.getTime() >= startOfToday.getTime() && tatDate.getTime() <= endOfToday.getTime();
      }
      return true;
    });
  }

  // Apply sorting
  const sort = filters.sort || "newest";
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

  return filteredTickets;
}

export function calculateStats(tickets: TicketRow[]): DashboardStats {
  return {
    total: tickets.length,
    open: tickets.filter((t) => {
      const normalized = normalizeStatusForComparison(t.status);
      return normalized === "open";
    }).length,
    inProgress: tickets.filter((t) => {
      const normalized = normalizeStatusForComparison(t.status);
      return normalized === "in_progress" || normalized === "escalated";
    }).length,
    awaitingStudent: tickets.filter((t) => {
      const normalized = normalizeStatusForComparison(t.status);
      return normalized === "awaiting_student_response";
    }).length,
    resolved: tickets.filter((t) => {
      const normalized = normalizeStatusForComparison(t.status);
      return normalized === "resolved" || normalized === "closed";
    }).length,
    escalated: tickets.filter((t) => (t.escalation_level || 0) > 0).length,
  };
}
