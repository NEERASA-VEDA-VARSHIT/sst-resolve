import { cache } from "react";
import { db, tickets, users, categories, ticket_statuses } from "@/db";
import { eq, or, isNull, desc } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import { getAdminAssignment } from "@/lib/assignment/admin-assignment";
import { getTicketStatuses } from "@/lib/status/getTicketStatuses";

/**
 * Cached helper functions for admin dashboard
 * Using React cache() for request-level deduplication
 */

// Cache user and role lookup (request-scoped)
export const getCachedAdminUser = cache(async (userId: string) => {
  const [dbUser, role] = await Promise.all([
    getOrCreateUser(userId),
    getUserRoleFromDB(userId),
  ]);
  return { dbUser, role };
});

// Cache admin assignment (request-scoped)
export const getCachedAdminAssignment = cache(async (userId: string) => {
  return await getAdminAssignment(userId);
});

// Cache ticket statuses (request-scoped, already cached internally but this ensures deduplication)
export const getCachedTicketStatuses = cache(async () => {
  return await getTicketStatuses();
});

// Cache categories for filtering (request-scoped)
export const getCachedCategories = cache(async () => {
  return await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
    })
    .from(categories)
    .where(eq(categories.is_active, true));
});

// Cache user lookup (request-scoped) - generic version for student/committee
export const getCachedUser = cache(async (userId: string) => {
  return await getOrCreateUser(userId);
});

// Cache committee tickets (request-scoped) - user-specific
export const getCachedCommitteeTickets = cache(async (userId: string) => {
  const { getAllCommitteeTickets } = await import("@/lib/committee/getAllCommitteeTickets");
  return await getAllCommitteeTickets(userId);
});

/**
 * Cached function to get admin's tickets with optimized query
 * This is request-scoped cached to prevent duplicate queries
 */
export const getCachedAdminTickets = cache(async (
  adminUserDbId: string,
  adminAssignment: { domain?: string | null; scope?: string | null }
) => {
  const hasAssignment = !!adminAssignment.domain;

  // Build base query conditions
  const baseConditions = hasAssignment
    ? or(
        eq(tickets.assigned_to, adminUserDbId),
        isNull(tickets.assigned_to)
      )
    : eq(tickets.assigned_to, adminUserDbId);

  // Fetch tickets with all necessary joins in a single query
  // Include all ticket fields needed for TicketCard component
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
      creator_id: users.id,
      creator_full_name: users.full_name,
      creator_email: users.email,
    })
    .from(tickets)
    .leftJoin(categories, eq(tickets.category_id, categories.id))
    .leftJoin(users, eq(tickets.created_by, users.id))
    .leftJoin(ticket_statuses, eq(ticket_statuses.id, tickets.status_id))
    .where(baseConditions)
    .orderBy(desc(tickets.created_at))
    .limit(1000); // Reasonable limit for admin view

  // Fetch all statuses once for lookup
  const allStatuses = await getTicketStatuses();
  const statusMap = new Map(allStatuses.map(s => [s.value.toLowerCase(), s]));

  // Transform to include all fields in a flat structure
  return ticketRows.map((row) => {
    const fallbackStatus = row.status ?? "open";
    const normalizedStatus = fallbackStatus.toLowerCase();
    const statusRecord = statusMap.get(normalizedStatus);
    
    const statusDisplay = statusRecord
      ? {
          value: statusRecord.value,
          label: statusRecord.label,
          badge_color: statusRecord.badge_color || "default",
        }
      : {
          value: fallbackStatus,
          label: fallbackStatus,
          badge_color: "default",
        };

    return {
      ...row,
      status_value: row.status ?? statusDisplay.value,
      status_label: statusDisplay.label,
      status_badge_color: statusDisplay.badge_color,
      status: row.status ?? statusDisplay.value,
    };
  });
});

