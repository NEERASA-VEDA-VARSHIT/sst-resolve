/**
 * Standardized API Error Response Format
 * Ensures consistent error handling across all API routes
 */

import { NextResponse } from "next/server";
import { logger } from "./logger";
import { env } from "@/conf/config";

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR"
  | "RATE_LIMIT_EXCEEDED"
  | "SERVICE_UNAVAILABLE";

export interface ApiError {
  error: string;
  message: string;
  code: ErrorCode;
  details?: unknown;
}

/**
 * Create a standardized error response
 * Never exposes internal errors or stack traces in production
 */
export function createErrorResponse(
  status: number,
  code: ErrorCode,
  message: string,
  details?: unknown,
  internalError?: Error | unknown
): NextResponse<ApiError> {
  // Log the full error internally (including stack trace in dev)
  if (internalError) {
    logger.error(`API Error [${code}]: ${message}`, internalError, {
      status,
      code,
      details: env.isDevelopment ? details : undefined,
    });
  }

  // Return sanitized error to client
  const response: ApiError = {
    error: getErrorTitle(status),
    message,
    code,
    // Only include details in development
    ...(env.isDevelopment && details ? { details } : {}),
  };

  return NextResponse.json(response, { status });
}

/**
 * Get error title based on HTTP status
 */
function getErrorTitle(status: number): string {
  switch (status) {
    case 400:
      return "Bad Request";
    case 401:
      return "Unauthorized";
    case 403:
      return "Forbidden";
    case 404:
      return "Not Found";
    case 429:
      return "Too Many Requests";
    case 500:
      return "Internal Server Error";
    case 503:
      return "Service Unavailable";
    default:
      return "Error";
  }
}

/**
 * Helper functions for common error responses
 */
export const apiErrors = {
  unauthorized: (message = "Unauthorized access") =>
    createErrorResponse(401, "UNAUTHORIZED", message),

  forbidden: (message = "Access forbidden") =>
    createErrorResponse(403, "FORBIDDEN", message),

  notFound: (message = "Resource not found") =>
    createErrorResponse(404, "NOT_FOUND", message),

  badRequest: (message = "Invalid request", details?: unknown) =>
    createErrorResponse(400, "BAD_REQUEST", message, details),

  validationError: (message = "Validation failed", details?: unknown) =>
    createErrorResponse(400, "VALIDATION_ERROR", message, details),

  internalError: (message = "An internal error occurred", error?: Error | unknown) =>
    createErrorResponse(500, "INTERNAL_ERROR", message, undefined, error),

  rateLimitExceeded: (message = "Rate limit exceeded") =>
    createErrorResponse(429, "RATE_LIMIT_EXCEEDED", message),

  serviceUnavailable: (message = "Service temporarily unavailable") =>
    createErrorResponse(503, "SERVICE_UNAVAILABLE", message),
};

