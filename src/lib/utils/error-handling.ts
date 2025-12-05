/**
 * Centralized error handling utilities
 * Replaces duplicate error handling logic across 50+ files
 */

import { toast } from "sonner";

export interface ErrorDetails {
  message: string;
  code?: string;
  status?: number;
}

/**
 * Extract error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "An unexpected error occurred";
}

/**
 * Extract error details from API errors
 */
export function getErrorDetails(error: unknown): ErrorDetails {
  if (error instanceof Error) {
    return {
      message: error.message,
    };
  }
  if (error && typeof error === "object") {
    return {
      message: "message" in error ? String(error.message) : "An error occurred",
      code: "code" in error ? String(error.code) : undefined,
      status: "status" in error && typeof error.status === "number" ? error.status : undefined,
    };
  }
  return {
    message: "An unexpected error occurred",
  };
}

/**
 * Handle API errors with toast notification
 */
export function handleApiError(error: unknown, defaultMessage = "Operation failed"): void {
  const details = getErrorDetails(error);
  const message = details.message || defaultMessage;
  
  console.error("[API Error]:", details);
  
  toast.error(message, {
    description: details.code ? `Error code: ${details.code}` : undefined,
  });
}

/**
 * Handle form validation errors
 */
export function handleValidationError(field: string, message: string): void {
  toast.error(`Validation error: ${field}`, {
    description: message,
  });
}

/**
 * Safe async error handler wrapper
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  errorMessage = "Operation failed"
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    handleApiError(error, errorMessage);
    return null;
  }
}
