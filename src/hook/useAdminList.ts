"use client";

import { useState, useEffect } from "react";

interface Admin {
  id: string;
  name: string;
  email: string;
  domain: string | null;
  scope: string | null;
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
 */
export function useAdminList(): UseAdminListReturn {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/admin/list");
      
      if (response.ok) {
        const data = await response.json();
        const normalized = Array.isArray(data.admins)
          ? data.admins.map((admin: any) => ({
              id: String(admin.id ?? ""),
              name: String(admin.name ?? ""),
              email: String(admin.email ?? ""),
              domain: admin.domain ?? null,
              scope: admin.scope ?? null,
            })).filter((admin: Admin) => admin.id.length > 0)
          : [];
        setAdmins(normalized);
      } else {
        throw new Error("Failed to fetch admin list");
      }
    } catch (err) {
      console.error("Error fetching admins:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  return {
    admins,
    loading,
    error,
    refetch: fetchAdmins,
  };
}

