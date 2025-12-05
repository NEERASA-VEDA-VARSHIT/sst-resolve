/**
 * Admin ticket filtering utilities
 * Centralized filtering logic for admin dashboard
 */

import { parseTicketMetadata } from "@/db/inferred-types";
import { normalizeStatus } from "../utils/normalizeStatus";
import { filterEscalatedTickets } from "./filterByStatus";

/**
 * Type for ticket with joined data (from cached queries)
 */
export type AdminTicketRow = {
  id: number;
  title: string | null;
  description: string | null;
  location: string | null;
  status_id: number | null;
  status_value?: string | null;
  status_label?: string | null;
  status_badge_color?: string | null;
  category_id: number | null;
  subcategory_id: number | null;
  created_by: string | null;
  assigned_to: string | null;
  group_id: number | null;
  escalation_level: number | null;
  acknowledgement_due_at: Date | null;
  resolution_due_at: Date | null;
  metadata: unknown; // JSONB
  created_at: Date | null;
  updated_at: Date | null;
  category_name?: string | null;
  creator_full_name?: string | null;
  creator_email?: string | null;
  status?: string | null; // Alias for status_value
};

/**
 * Apply search filter to tickets
 */
export function applySearchFilter(
  tickets: AdminTicketRow[],
  searchQuery: string
): AdminTicketRow[] {
  if (!searchQuery) return tickets;
  
  const query = searchQuery.toLowerCase();
  return tickets.filter(t => {
    const idMatch = t.id.toString().includes(query);
    const descMatch = (t.description || "").toLowerCase().includes(query);
    
    // Get subcategory from metadata
    const metadata = parseTicketMetadata(t.metadata);
    const subcatName = metadata.subcategory || "";
    const subcatMatch = subcatName.toLowerCase().includes(query);
    
    return idMatch || descMatch || subcatMatch;
  });
}

/**
 * Apply category filter
 */
export function applyCategoryFilter(
  tickets: AdminTicketRow[],
  categoryFilter: string,
  categoryMap: Map<number, { name: string; domain: string | null }>
): AdminTicketRow[] {
  if (!categoryFilter) return tickets;
  
  const filterLower = categoryFilter.toLowerCase();
  return tickets.filter(t => {
    const ticketCategory = t.category_id ? categoryMap.get(t.category_id) : null;
    const categoryName = ticketCategory?.name || t.category_name || "";
    return categoryName.toLowerCase() === filterLower;
  });
}

/**
 * Apply subcategory filter
 */
export function applySubcategoryFilter(
  tickets: AdminTicketRow[],
  subcategoryFilter: string
): AdminTicketRow[] {
  if (!subcategoryFilter) return tickets;
  
  const filterLower = subcategoryFilter.toLowerCase();
  return tickets.filter(t => {
    const metadata = parseTicketMetadata(t.metadata);
    const subcatName = metadata.subcategory || "";
    return subcatName.toLowerCase().includes(filterLower);
  });
}

/**
 * Apply location filter
 */
export function applyLocationFilter(
  tickets: AdminTicketRow[],
  locationFilter: string
): AdminTicketRow[] {
  if (!locationFilter) return tickets;
  
  const filterLower = locationFilter.toLowerCase();
  return tickets.filter(t => (t.location || "").toLowerCase().includes(filterLower));
}

/**
 * Apply status filter using canonical status values
 */
export function applyStatusFilter(
  tickets: AdminTicketRow[],
  statusFilter: string
): AdminTicketRow[] {
  if (!statusFilter) return tickets;
  
  const normalizedFilter = normalizeStatus(statusFilter);
  if (!normalizedFilter) return tickets;
  
  return tickets.filter(t => {
    const ticketStatus = t.status || t.status_value;
    const normalizedTicketStatus = normalizeStatus(ticketStatus);
    
    // Handle special cases
    if (normalizedFilter === "escalated") {
      // Escalated can be either status or escalation_level > 0
      return normalizedTicketStatus === "escalated" || (t.escalation_level || 0) > 0;
    }
    
    return normalizedTicketStatus === normalizedFilter;
  });
}

/**
 * Apply escalated filter
 */
export function applyEscalatedFilter(
  tickets: AdminTicketRow[],
  escalated: string
): AdminTicketRow[] {
  if (escalated !== "true") return tickets;
  return filterEscalatedTickets(tickets);
}

/**
 * Apply user filter (searches creator email and name)
 */
export function applyUserFilter(
  tickets: AdminTicketRow[],
  userFilter: string
): AdminTicketRow[] {
  if (!userFilter) return tickets;
  
  const filterLower = userFilter.toLowerCase();
  return tickets.filter(t => {
    const creatorEmail = (t.creator_email || "").toLowerCase();
    const creatorName = (t.creator_full_name || "").toLowerCase();
    return creatorEmail.includes(filterLower) || creatorName.includes(filterLower);
  });
}

/**
 * Apply date range filter
 */
export function applyDateRangeFilter(
  tickets: AdminTicketRow[],
  createdFrom?: string,
  createdTo?: string
): AdminTicketRow[] {
  let filtered = tickets;
  
  if (createdFrom) {
    const from = new Date(createdFrom);
    from.setHours(0, 0, 0, 0);
    filtered = filtered.filter(t => 
      t.created_at ? new Date(t.created_at).getTime() >= from.getTime() : false
    );
  }
  
  if (createdTo) {
    const to = new Date(createdTo);
    to.setHours(23, 59, 59, 999);
    filtered = filtered.filter(t => 
      t.created_at ? new Date(t.created_at).getTime() <= to.getTime() : false
    );
  }
  
  return filtered;
}

/**
 * Apply TAT filter
 */
export function applyTATFilter(
  tickets: AdminTicketRow[],
  tatFilter: string
): AdminTicketRow[] {
  if (!tatFilter) return tickets;
  
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  
  return tickets.filter(t => {
    const metadata = parseTicketMetadata(t.metadata);
    const tatDateStr = metadata.tatDate;
    
    if (!tatDateStr || typeof tatDateStr !== 'string') {
      if (tatFilter === "none") return true;
      return false;
    }
    
    const tatDate = new Date(tatDateStr);
    if (isNaN(tatDate.getTime())) {
      if (tatFilter === "none") return true;
      return false;
    }
    
    const hasTat = true;
    
    switch (tatFilter) {
      case "has":
        return hasTat;
      case "none":
        return !hasTat;
      case "due":
        return hasTat && tatDate.getTime() < now.getTime();
      case "upcoming":
        return hasTat && tatDate.getTime() >= now.getTime();
      case "today":
        return hasTat && 
               tatDate.getTime() >= startOfToday.getTime() && 
               tatDate.getTime() <= endOfToday.getTime();
      default:
        return true;
    }
  });
}

/**
 * Calculate ticket statistics
 */
export function calculateTicketStats(
  tickets: AdminTicketRow[],
): {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  awaitingStudent: number;
  escalated: number;
} {
  const stats = {
    total: tickets.length,
    open: 0,
    inProgress: 0,
    resolved: 0,
    awaitingStudent: 0,
    escalated: 0,
  };
  
  for (const ticket of tickets) {
    const status = ticket.status || ticket.status_value;
    const normalizedStatus = normalizeStatus(status);
    
    if (normalizedStatus === "open") {
      stats.open++;
    } else if (normalizedStatus === "in_progress") {
      stats.inProgress++;
    } else if (normalizedStatus === "resolved") {
      stats.resolved++;
    } else if (normalizedStatus === "awaiting_student") {
      stats.awaitingStudent++;
    }
    
    if ((ticket.escalation_level || 0) > 0) {
      stats.escalated++;
    }
  }
  
  return stats;
}
