"use client";

import { useState, useCallback } from "react";
import { api, apiRequest, ApiRequestOptions, ApiResponse, ApiError } from "@/lib/api/client";

export interface UseApiOptions extends Omit<ApiRequestOptions, "skipErrorToast"> {
  skipErrorToast?: boolean;
  onSuccess?: (data: unknown) => void;
  onError?: (error: ApiError) => void;
}

export interface UseApiReturn<T = unknown> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  execute: (url: string, options?: UseApiOptions) => Promise<T | null>;
  reset: () => void;
}

/**
 * Generic API hook with loading and error states
 * Replaces duplicate fetch logic across 60+ components
 */
export function useApi<T = unknown>(): UseApiReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const execute = useCallback(
    async (url: string, options: UseApiOptions = {}): Promise<T | null> => {
      const { onSuccess, onError, skipErrorToast, ...apiOptions } = options;

      setLoading(true);
      setError(null);

      try {
        // Use the api convenience methods based on method
        let response: ApiResponse<T>;
        const method = apiOptions.method || "GET";
        
        if (method === "GET") {
          response = await api.get<T>(url, { ...apiOptions, skipErrorToast });
        } else if (method === "POST") {
          response = await api.post<T>(url, apiOptions.body, { ...apiOptions, skipErrorToast });
        } else if (method === "PUT") {
          response = await api.put<T>(url, apiOptions.body, { ...apiOptions, skipErrorToast });
        } else if (method === "PATCH") {
          response = await api.patch<T>(url, apiOptions.body, { ...apiOptions, skipErrorToast });
        } else if (method === "DELETE") {
          response = await api.delete<T>(url, { ...apiOptions, skipErrorToast });
        } else {
          // Fallback to direct apiRequest
          response = await apiRequest<T>(url, {
            ...apiOptions,
            skipErrorToast: skipErrorToast ?? false,
          });
        }

        setData(response.data);
        onSuccess?.(response.data);
        return response.data;
      } catch (err) {
        const apiError = err instanceof ApiError ? err : new ApiError(
          err instanceof Error ? err.message : "Unknown error",
          0,
          "Error",
          err
        );
        setError(apiError);
        onError?.(apiError);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset };
}

// Re-export api utilities for direct use if needed
export { api, apiRequest };
export type { ApiRequestOptions, ApiResponse, ApiError };
