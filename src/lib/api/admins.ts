/**
 * Centralized admin/staff fetching utilities
 * Consolidates useFetchAdmins and useAdminList hooks
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { api, endpoints } from "./client";

export interface Admin {
  id: string;
  email: string;
  full_name: string | null;
  fullName?: string;
  name?: string;
  domain?: string | null;
  scope?: string | null;
}

interface StaffResponse {
  staff: Array<{
    id: string;
    email: string;
    fullName?: string;
    name?: string;
    domain?: string;
    scope?: string;
    [key: string]: unknown;
  }>;
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

/**
 * Fetch admins from /api/admin/staff endpoint
 * Used by CategoryDialog, SubcategoryDialog
 */
export async function fetchAdminsFromStaff(): Promise<Admin[]> {
  try {
    const response = await api.get<StaffResponse>(endpoints.admin.staff, {
      skipErrorToast: true,
    });

    if (response.data?.staff) {
      return response.data.staff.map((staff) => ({
        id: staff.id,
        email: staff.email || "",
        full_name: (staff.fullName || staff.name || staff.email || "Unknown") as string,
        fullName: staff.fullName || staff.name || staff.email || "Unknown",
        name: staff.name || staff.fullName || staff.email || "Unknown",
        domain: staff.domain ?? null,
        scope: staff.scope ?? null,
      }));
    }
    return [];
  } catch (error) {
    console.error("Error fetching admins from staff:", error);
    return [];
  }
}

/**
 * Fetch admins from /api/admin/list endpoint
 * Used by ReassignDialog, FieldDialog
 */
export async function fetchAdminsFromList(): Promise<Admin[]> {
  try {
    const response = await api.get<AdminListResponse>("/api/admin/list", {
      skipErrorToast: true,
    });

    if (response.data?.admins) {
      return response.data.admins
        .map((admin) => ({
          id: String(admin.id ?? ""),
          email: String(admin.email ?? ""),
          full_name: String(admin.name ?? admin.email ?? "Unknown"),
          fullName: String(admin.name ?? admin.email ?? "Unknown"),
          name: String(admin.name ?? admin.email ?? "Unknown"),
          domain: typeof admin.domain === "string" ? admin.domain : null,
          scope: typeof admin.scope === "string" ? admin.scope : null,
        }))
        .filter((admin) => admin.id.length > 0);
    }
    return [];
  } catch (error) {
    console.error("Error fetching admins from list:", error);
    return [];
  }
}

/**
 * Unified hook for fetching admins
 * Automatically uses the correct endpoint based on context
 */
export function useAdmins(endpoint: "staff" | "list" = "staff") {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAdmins = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = endpoint === "staff" 
        ? await fetchAdminsFromStaff()
        : await fetchAdminsFromList();
      
      setAdmins(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

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
