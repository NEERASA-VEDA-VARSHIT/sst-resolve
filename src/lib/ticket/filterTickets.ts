/**
 * Filter tickets by search, status, and category
 * Uses centralized status normalization for consistency
 */

import { normalizeStatus, statusMatches } from "./normalizeStatus";

type Ticket = {
  id: number;
  description: string | null;
  category_name: string | null;
  status: string | null;
};

export function filterTickets(
  tickets: Ticket[],
  search: string,
  statusFilter: string,
  categoryFilter: string
): Ticket[] {
  let filtered = [...tickets];

  // Apply search filter
  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(t =>
      t.id.toString().includes(search) ||
      (t.description || "").toLowerCase().includes(searchLower) ||
      (t.category_name || "").toLowerCase().includes(searchLower)
    );
  }

  // Apply status filter using canonical status values
  if (statusFilter) {
    const normalizedFilter = normalizeStatus(statusFilter);
    if (normalizedFilter) {
      filtered = filtered.filter(t => statusMatches(t.status, normalizedFilter));
    }
  }

  // Apply category filter
  if (categoryFilter) {
    filtered = filtered.filter(t =>
      (t.category_name || "").toLowerCase() === categoryFilter.toLowerCase()
    );
  }

  return filtered;
}
