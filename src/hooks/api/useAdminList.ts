"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api/client";

export interface Admin {
  id: string;
  name: string;
  email: string;
  domain: string | null;
  scope: string | null;
}

interface AdminListResponse {
  admins: Array<{
    id?: unknown;
    name?: unknown;
    email?: unknown;
    domain?: unknown;
    scope?: unknown;
  }>;
}

interface UseAdminListReturn {
  admins: Admin[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook to fetch and manage admin list
 * Used in ReassignDialog for ticket reassignment
 * Moved from src/hook/useAdminList.ts and updated to use centralized API client
 */
export function useAdminList(): UseAdminListReturn {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAdmins = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get<AdminListResponse>("/api/admin/list", {
        skipErrorToast: true, // Handle errors manually
      });

      const normalized = Array.isArray(response.data.admins)
        ? response.data.admins
            .map((admin) => ({
              id: String(admin.id ?? ""),
              name: String(admin.name ?? ""),
              email: String(admin.email ?? ""),
              domain: typeof admin.domain === "string" ? admin.domain : null,
              scope: typeof admin.scope === "string" ? admin.scope : null,
            }))
            .filter((admin) => admin.id.length > 0)
        : [];
      setAdmins(normalized);
    } catch (err) {
      console.error("Error fetching admins:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  return {
    admins,
    loading,
    error,
    refetch: fetchAdmins,
  };
}
