"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";

export type UserRole = "student" | "admin" | "super_admin" | "committee";

/**
 * Custom hook for fetching and caching user role
 * Handles role fetching from API with sessionStorage caching
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
      // Use AbortController for cleanup
      const controller = new AbortController();

      // Use sessionStorage to cache role to avoid repeated API calls
      const cachedRole =
        typeof window !== "undefined"
          ? sessionStorage.getItem(`role_${user.id}`)
          : null;
      if (
        cachedRole &&
        ["student", "admin", "super_admin", "committee"].includes(cachedRole)
      ) {
        setRole(cachedRole as UserRole);
        setLoading(false);
        return;
      }

      fetch(`/api/auth/role?userId=${user.id}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (data?.role) {
            const roleValue = data.role as UserRole;
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
    }
  }, [user?.id]);

  return {
    role,
    loading: !mounted || loading,
    mounted,
  };
}

