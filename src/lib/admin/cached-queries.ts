import { cache } from "react";
import { db, tickets, users, categories, ticket_statuses } from "@/db";
import { eq, or, isNull, desc } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";
import { getAdminAssignment } from "@/lib/admin-assignment";
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
    .where(eq(categories.active, true));
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
      // All ticket fields
      ticket: tickets,
      // Joined fields
      status_value: ticket_statuses.value,
      status_label: ticket_statuses.label,
      status_badge_color: ticket_statuses.badge_color,
      category_name: categories.name,
      creator_id: users.id,
      creator_first_name: users.first_name,
      creator_last_name: users.last_name,
      creator_email: users.email,
    })
    .from(tickets)
    .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
    .leftJoin(categories, eq(tickets.category_id, categories.id))
    .leftJoin(users, eq(tickets.created_by, users.id))
    .where(baseConditions)
    .orderBy(desc(tickets.created_at))
    .limit(1000); // Reasonable limit for admin view

  // Transform to include all fields in a flat structure
  return ticketRows.map(row => ({
    ...row.ticket,
    status_value: row.status_value,
    status_label: row.status_label,
    status_badge_color: row.status_badge_color,
    category_name: row.category_name,
    creator_id: row.creator_id,
    creator_first_name: row.creator_first_name,
    creator_last_name: row.creator_last_name,
    creator_email: row.creator_email,
  }));
});

