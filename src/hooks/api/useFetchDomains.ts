"use client";

import { useState, useEffect, useCallback } from "react";
import { api, endpoints } from "@/lib/api/client";

export interface Domain {
  id: number;
  name: string;
  description: string | null;
}

export interface Scope {
  id: number;
  domain_id: number;
  name: string;
  description: string | null;
}

interface DomainsResponse {
  domains: Domain[];
  scopes: Scope[];
}

/**
 * Hook to fetch domains and scopes
 * Replaces duplicate fetchDomains() logic from CategoryDialog
 */
export function useFetchDomains() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchDomains = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get<DomainsResponse>(endpoints.domains, {
        skipErrorToast: true,
      });

      setDomains(response.data.domains || []);
      setScopes(response.data.scopes || []);
    } catch (err) {
      console.error("Failed to fetch domains:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch domains"));
      setDomains([]);
      setScopes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  return {
    domains,
    scopes,
    loading,
    error,
    refetch: fetchDomains,
  };
}
