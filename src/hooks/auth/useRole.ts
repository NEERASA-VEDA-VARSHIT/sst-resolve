"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/lib/api/client";

export type UserRole = "student" | "admin" | "snr_admin" | "super_admin" | "committee";

/**
 * Custom hook for fetching and caching user role
 * Handles role fetching from API with sessionStorage caching
 * Moved from components/nav/useRole.ts to hooks/auth/useRole.ts
 */
export function useRole() {
  const { user } = useUser();
  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState<UserRole>("student");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);

    // Fetch role from database API (single source of truth)
    if (user?.id) {
      setLoading(true);

      // Use sessionStorage to cache role to avoid repeated API calls
      const cachedRole =
        typeof window !== "undefined"
          ? sessionStorage.getItem(`role_${user.id}`)
          : null;
      if (
        cachedRole &&
        ["student", "admin", "snr_admin", "super_admin", "committee"].includes(cachedRole)
      ) {
        setRole(cachedRole as UserRole);
        setLoading(false);
        return;
      }

      // Use AbortController for cleanup
      const controller = new AbortController();

      // Use centralized API client
      api
        .get<{ role: UserRole }>(`/api/auth/role?userId=${user.id}`, {
          skipErrorToast: true,
          signal: controller.signal,
        })
        .then((response) => {
          if (response.data?.role) {
            const roleValue = response.data.role;
            setRole(roleValue);
            // Cache in sessionStorage
            if (typeof window !== "undefined") {
              sessionStorage.setItem(`role_${user.id}`, roleValue);
            }
          }
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            console.error("[useRole] Error fetching role:", err);
            // Default to student on error
            setRole("student");
          }
        })
        .finally(() => {
          setLoading(false);
        });

      // Cleanup function
      return () => {
        controller.abort();
      };
    } else {
      setLoading(false);
      return undefined;
    }
  }, [user?.id]);

  return {
    role,
    loading: !mounted || loading,
    mounted,
  };
}
