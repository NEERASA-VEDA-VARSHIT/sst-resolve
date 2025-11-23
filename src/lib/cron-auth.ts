/**
 * Cron Job Authentication Helper
 * Enforces secure authentication for cron endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { cronConfig, env } from "@/conf/config";
import { apiErrors } from "./api-error";
import { logger } from "./logger";

/**
 * Verify cron job authentication
 * In production, CRON_SECRET is mandatory
 * 
 * @param request - The incoming request
 * @returns null if authenticated, error response if not
 */
export function verifyCronAuth(request: NextRequest): NextResponse | null {
  // In production, CRON_SECRET must be set
  if (env.isProduction && !cronConfig.secret) {
    logger.error("[Cron Auth] CRON_SECRET not set in production - this is a security risk!");
    return apiErrors.internalError(
      "Cron authentication not configured",
      new Error("CRON_SECRET missing in production")
    );
  }

  // If no secret is configured, allow in development only
  if (!cronConfig.secret) {
    if (env.isDevelopment) {
      logger.warn("[Cron Auth] CRON_SECRET not set - allowing in development mode only");
      return null;
    }
    // In production without secret, deny access
    return apiErrors.unauthorized("Cron authentication required");
  }

  // Verify Bearer token
  const authHeader = request.headers.get("authorization");
  const expectedAuth = `Bearer ${cronConfig.secret}`;

  if (!authHeader || authHeader !== expectedAuth) {
    // Log unauthorized access attempts (but don't expose details)
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    logger.warn("[Cron Auth] Unauthorized access attempt", {
      ip: clientIp,
      path: request.nextUrl.pathname,
    });

    return apiErrors.unauthorized("Invalid or missing cron authentication");
  }

  return null;
}

