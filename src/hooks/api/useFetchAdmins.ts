"use client";

import { useState, useEffect, useCallback } from "react";
import { useApi } from "./useApi";
import { endpoints } from "@/lib/api/client";

export interface Admin {
  id: string;
  email: string;
  full_name: string | null;
  fullName?: string;
  domain?: string | null;
  scope?: string | null;
}

interface StaffResponse {
  staff: Array<{
    id: string;
    email: string;
    fullName?: string;
    domain?: string;
    scope?: string;
    [key: string]: unknown;
  }>;
}

/**
 * Hook to fetch admin/staff list
 * Replaces duplicate fetchAdmins() logic from 5+ components
 */
export function useFetchAdmins() {
  const { loading, error, execute } = useApi<StaffResponse>();
  const [admins, setAdmins] = useState<Admin[]>([]);

  const fetchAdmins = useCallback(async () => {
    const result = await execute(endpoints.admin.staff, {
      skipErrorToast: true, // Handle errors manually
    });

    if (result?.staff) {
      const mapped: Admin[] = result.staff.map((staff) => ({
        id: staff.id,
        email: staff.email || "",
        full_name: (staff.fullName || staff.email || "Unknown") as string,
        fullName: staff.fullName || staff.email || "Unknown",
        domain: staff.domain ?? null,
        scope: staff.scope ?? null,
      }));
      setAdmins(mapped);
    } else {
      setAdmins([]);
    }
  }, [execute]);

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
