"use client";

import { useState, useEffect, useCallback } from "react";
import type { Ticket, TicketFilterInput } from "@/model/ticket.model";

interface UseTicketsReturn {
  tickets: Ticket[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  filters: TicketFilterInput;
  setFilters: (filters: Partial<TicketFilterInput>) => void;
}

/**
 * Custom hook to fetch and manage tickets
 * Supports filtering and refetching
 */
export function useTickets(initialFilters?: Partial<TicketFilterInput>) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<TicketFilterInput>({
    sort: "newest",
    ...initialFilters,
  });

  const buildQueryString = useCallback((filters: TicketFilterInput): string => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.append(key, String(value));
      }
    });
    return params.toString();
  }, []);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const queryString = buildQueryString(filters);
      const url = queryString ? `/api/tickets?${queryString}` : "/api/tickets";
      
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        setTickets(data);
      } else {
        throw new Error("Failed to fetch tickets");
      }
    } catch (err) {
      console.error("Error fetching tickets:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [filters, buildQueryString]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const setFilters = useCallback((newFilters: Partial<TicketFilterInput>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
  }, []);

  return {
    tickets,
    loading,
    error,
    refetch: fetchTickets,
    filters,
    setFilters,
  };
}

