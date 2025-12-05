/**
 * Centralized API client
 * Replaces 60+ direct fetch() calls across components with a unified interface
 */

import { toast } from "sonner";

export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiRequestOptions extends RequestInit {
  method?: ApiMethod;
  skipErrorToast?: boolean;
  skipContentTypeCheck?: boolean;
}

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public statusText: string,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Centralized fetch wrapper with error handling and content-type checking
 */
export async function apiRequest<T = unknown>(
  url: string,
  options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  const {
    method = "GET",
    skipErrorToast = false,
    skipContentTypeCheck = false,
    headers = {},
    ...fetchOptions
  } = options;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      ...fetchOptions,
    });

    // Check Content-Type before parsing JSON
    if (!skipContentTypeCheck) {
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text().catch(() => "Unknown error");
        throw new ApiError(
          `API returned non-JSON response: ${contentType || "unknown"}`,
          response.status,
          response.statusText,
          text
        );
      }
    }

    // Parse response
    let data: T;
    try {
      data = await response.json();
    } catch (parseError) {
      // If response is not JSON, try to get text
      const text = await response.text().catch(() => "Unknown error");
      throw new ApiError(
        `Failed to parse JSON response: ${text.substring(0, 100)}`,
        response.status,
        response.statusText,
        text
      );
    }

    // Handle error responses
    if (!response.ok) {
      const errorMessage =
        (data as { error?: string })?.error ||
        (data as { message?: string })?.message ||
        `Request failed with status ${response.status}`;

      if (!skipErrorToast) {
        toast.error(errorMessage);
      }

      throw new ApiError(errorMessage, response.status, response.statusText, data);
    }

    return {
      data,
      status: response.status,
      statusText: response.statusText,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    // Handle network errors or other exceptions
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    if (!skipErrorToast) {
      toast.error(`Request failed: ${errorMessage}`);
    }

    throw new ApiError(errorMessage, 0, "Network Error", error);
  }
}

/**
 * Convenience methods for common HTTP methods
 */
export const api = {
  get: <T = unknown>(url: string, options?: Omit<ApiRequestOptions, "method">) =>
    apiRequest<T>(url, { ...options, method: "GET" }),

  post: <T = unknown>(url: string, body?: unknown, options?: Omit<ApiRequestOptions, "method" | "body">) => {
    const isFormData = body instanceof FormData;
    return apiRequest<T>(url, {
      ...options,
      method: "POST",
      body: isFormData ? body : body ? JSON.stringify(body) : undefined,
      headers: isFormData
        ? { ...options?.headers } // Don't set Content-Type for FormData
        : {
            "Content-Type": "application/json",
            ...options?.headers,
          },
      skipContentTypeCheck: isFormData ? true : options?.skipContentTypeCheck,
    });
  },

  put: <T = unknown>(url: string, body?: unknown, options?: Omit<ApiRequestOptions, "method" | "body">) =>
    apiRequest<T>(url, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T = unknown>(url: string, body?: unknown, options?: Omit<ApiRequestOptions, "method" | "body">) =>
    apiRequest<T>(url, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T = unknown>(url: string, options?: Omit<ApiRequestOptions, "method">) =>
    apiRequest<T>(url, { ...options, method: "DELETE" }),
};

/**
 * Type-safe endpoint definitions
 * Add endpoints here as they're used
 */
export const endpoints = {
  admin: {
    staff: "/api/admin/staff",
    categories: "/api/admin/categories",
    subcategories: "/api/admin/subcategories",
    fields: "/api/admin/fields",
  },
  domains: "/api/domains",
  tickets: "/api/tickets",
  ticket: (id: number) => `/api/tickets/${id}`,
  ticketReassign: (id: number) => `/api/tickets/${id}/reassign`,
  users: "/api/users",
} as const;
