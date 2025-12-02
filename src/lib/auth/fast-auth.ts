/**
 * Fast Authentication & Authorization
 * Optimized auth checks that skip expensive operations for read-only requests
 * Use this for GET endpoints that don't need user sync
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getUserRoleFromDB } from "./db-roles";
import type { UserRole } from "@/types/auth";
import { logCriticalError, logWarning } from "@/lib/monitoring/alerts";

/**
 * Fast auth check for read-only endpoints
 * Skips user sync, only validates Clerk auth + role
 * 
 * @param allowedRoles - Array of roles allowed to access the endpoint
 * @returns { userId, role } or NextResponse with error
 */
export async function fastAuthCheck(allowedRoles: UserRole[]): Promise<
  { userId: string; role: UserRole } | NextResponse
> {
  try {
    // 1. Check Clerk authentication (fast)
    // Edge case: Handle Clerk API timeout/downtime gracefully
    let userId: string | null = null;
    try {
      const authResult = await auth();
      userId = authResult.userId;
    } catch (authError) {
      logCriticalError(
        "Clerk authentication API failure",
        authError,
        { endpoint: "fastAuthCheck" }
      );
      // If Clerk API is down, return 503 Service Unavailable
      return NextResponse.json(
        { error: "Authentication service temporarily unavailable. Please try again." },
        { status: 503 }
      );
    }
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get role from DB (uses cache for students, validates for admins)
    // Edge case: Handle role sync failures gracefully
    let role: UserRole;
    try {
      role = await getUserRoleFromDB(userId);
    } catch (roleError) {
      logWarning(
        "Failed to fetch user role from database",
        { userId, error: roleError instanceof Error ? roleError.message : String(roleError) }
      );
      // If role fetch fails, default to student (most restrictive)
      role = "student";
    }
    
    // Edge case: Role not found in DB - default to student
    if (!role) {
      logWarning(
        "User role not found in database",
        { userId }
      );
      role = "student";
    }
    
    // 3. Check if role is allowed
    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { error: "Forbidden - Insufficient permissions" }, 
        { status: 403 }
      );
    }

    // Return user info for use in handler
    return { userId, role };
  } catch (error) {
    logCriticalError(
      "Unexpected error during auth check",
      error,
      { endpoint: "fastAuthCheck" }
    );
    return NextResponse.json(
      { error: "Internal Server Error" }, 
      { status: 500 }
    );
  }
}

/**
 * Type guard to check if result is an error response
 */
export function isAuthError(
  result: { userId: string; role: UserRole } | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
