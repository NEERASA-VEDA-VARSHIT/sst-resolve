/**
 * Status filtering utilities
 * Provides consistent status filtering logic
 */

import { normalizeStatus, statusMatches } from "../utils/normalizeStatus";
import type { TicketStatusValue } from "@/conf/constants";

/**
 * Filter tickets by status value
 * Handles aliases and normalization automatically
 */
export function filterTicketsByStatus<T extends { status?: string | null }>(
  tickets: T[],
  filterStatus: string | null | undefined
): T[] {
  if (!filterStatus) return tickets;
  
  const normalizedFilter = normalizeStatus(filterStatus);
  if (!normalizedFilter) return tickets;
  
  return tickets.filter(ticket => {
    const ticketStatus = ticket.status;
    return statusMatches(ticketStatus, normalizedFilter);
  });
}

/**
 * Filter tickets by multiple status values (OR logic)
 */
export function filterTicketsByStatuses<T extends { status?: string | null }>(
  tickets: T[],
  filterStatuses: string[]
): T[] {
  if (filterStatuses.length === 0) return tickets;
  
  const normalizedFilters = filterStatuses
    .map(s => normalizeStatus(s))
    .filter((s): s is TicketStatusValue => s !== null);
  
  if (normalizedFilters.length === 0) return tickets;
  
  return tickets.filter(ticket => {
    const ticketStatus = ticket.status;
    return normalizedFilters.some(filter => statusMatches(ticketStatus, filter));
  });
}

/**
 * Filter escalated tickets (escalation_level > 0)
 */
export function filterEscalatedTickets<T extends { escalation_level?: number | null }>(
  tickets: T[]
): T[] {
  return tickets.filter(t => (t.escalation_level || 0) > 0);
}
