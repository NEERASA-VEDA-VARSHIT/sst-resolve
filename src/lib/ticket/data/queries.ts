import { db, tickets, users, categories, subcategories, ticket_statuses } from "@/db";
import { eq, ilike, and, or, sql, asc, desc } from "drizzle-orm";
import { getCanonicalStatus } from "@/conf/constants";
import type { SQL } from "drizzle-orm";

export interface TicketFilters {
  search?: string;
  status?: string;
  escalated?: string;
  category?: string;
  subcategory?: string;
  dynamicFilters?: Array<{ key: string; value: string }>;
}

export interface SortOptions {
  sortBy?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface StudentTicketQueryParams extends TicketFilters, SortOptions, PaginationOptions {
  userId: string;
}

/**
 * Build SQL filter conditions based on query parameters
 */
export function buildTicketFilters(
  params: TicketFilters,
  userId: string
): SQL[] {
  const conditions: SQL[] = [eq(tickets.created_by, userId)];

  // Search filter
  if (params.search) {
    const value = `%${params.search}%`;
    const searchConditions = [
      ilike(tickets.description, value),
      ilike(categories.name, value),
      sql`tickets.id::text ILIKE ${value}`,
    ].filter(Boolean);

    if (searchConditions.length > 0) {
      conditions.push(or(...searchConditions)!);
    }
  }

  // Escalated filter (check this before status filter to avoid conflicts)
  if (params.escalated === "true") {
    conditions.push(sql`${tickets.escalation_level} > 0`);
  }

  // Status filter
  if (params.status) {
    const canonical = (getCanonicalStatus(params.status) ?? params.status.toLowerCase()).toLowerCase();

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

  // Category filter (slug-based)
  if (params.category) {
    conditions.push(ilike(categories.slug, params.category.toLowerCase()));
  }

  // Subcategory filter - handled separately in getStudentTickets due to subquery requirement

  // Dynamic field filters (f_ prefix)
  if (params.dynamicFilters) {
    for (const { key, value } of params.dynamicFilters) {
      if (value) {
        const fieldSlug = key.replace("f_", "");
        conditions.push(sql`metadata->'dynamic_fields'->${fieldSlug}->>'value' = ${value}`);
      }
    }
  }

  return conditions;
}

/**
 * Build sort order SQL based on sort parameter
 */
export function buildSortOrder(sortBy?: string): ReturnType<typeof desc> | ReturnType<typeof asc> | SQL {
  switch (sortBy) {
    case "oldest":
      return asc(tickets.created_at);

    case "due-date":
      return asc(tickets.resolution_due_at);

    case "status":
      // Use joined ticket_statuses for status-based sorting
      return sql`
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

    default:
      // Sort by status priority first (active tickets first, closed/resolved last)
      // Then by updated_at desc to show recently updated tickets at the top
      return sql`
        CASE 
          WHEN LOWER(${ticket_statuses.value}) IN ('closed', 'resolved') THEN 1
          ELSE 0
        END,
        COALESCE(${tickets.updated_at}, ${tickets.created_at}) DESC
      `;
  }
}

/**
 * Get student tickets with filters, sorting, and pagination
 */
export async function getStudentTickets(params: StudentTicketQueryParams) {
  const {
    userId,
    search,
    status,
    escalated,
    category,
    subcategory,
    dynamicFilters,
    sortBy = "newest",
    page = 1,
    limit = 12,
  } = params;

  // Build base conditions (excluding subcategory which needs a subquery)
  const baseConditions = buildTicketFilters(
    { search, status, escalated, category, dynamicFilters },
    userId
  );

  // Handle subcategory filter separately (requires subquery)
  const conditions = [...baseConditions];
  if (subcategory) {
    const subcategoryResult = await db
      .select({ id: subcategories.id })
      .from(subcategories)
      .where(eq(subcategories.slug, subcategory))
      .limit(1);
    
    if (subcategoryResult.length > 0) {
      conditions.push(eq(tickets.subcategory_id, subcategoryResult[0].id));
    }
  }

  // Build sort order
  const orderBy = buildSortOrder(sortBy);

  // Calculate pagination
  const offset = (page - 1) * limit;

  // Fetch tickets
  const ticketRows = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      description: tickets.description,
      location: tickets.location,
      status_id: tickets.status_id,
      status: ticket_statuses.value,
      category_id: tickets.category_id,
      subcategory_id: tickets.subcategory_id,
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
    .offset(offset);

  // Count total tickets for pagination
  const countResult = await db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(tickets)
    .leftJoin(categories, eq(tickets.category_id, categories.id))
    .leftJoin(users, eq(tickets.created_by, users.id))
    .where(and(...conditions));

  const totalCount = Number(countResult[0]?.count || 0);
  const totalPages = Math.ceil(totalCount / limit);

  return {
    tickets: ticketRows,
    pagination: {
      totalCount,
      totalPages,
      currentPage: page,
      limit,
      offset,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      startIndex: totalCount > 0 ? offset + 1 : 0,
      endIndex: Math.min(offset + ticketRows.length, totalCount),
    },
  };
}

/**
 * Get ticket statistics for a student
 */
export async function getTicketStats(userId: string) {
  const statsResult = await db
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
    .where(eq(tickets.created_by, userId));

  // Ensure stats values are numbers with safe defaults
  return {
    total: Number(statsResult[0]?.total) || 0,
    open: Number(statsResult[0]?.open) || 0,
    inProgress: Number(statsResult[0]?.inProgress) || 0,
    awaitingStudent: Number(statsResult[0]?.awaitingStudent) || 0,
    reopened: Number(statsResult[0]?.reopened) || 0,
    resolved: Number(statsResult[0]?.resolved) || 0,
    closed: Number(statsResult[0]?.closed) || 0,
    escalated: Number(statsResult[0]?.escalated) || 0,
  };
}
