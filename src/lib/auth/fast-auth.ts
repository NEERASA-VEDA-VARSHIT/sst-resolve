/**
 * Fast Authentication & Authorization
 * Optimized auth checks that skip expensive operations for read-only requests
 * Use this for GET endpoints that don't need user sync
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getUserRoleFromDB } from "./db-roles";
import type { UserRole } from "@/types/auth";

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
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get role from DB (uses cache for students, validates for admins)
    const role = await getUserRoleFromDB(userId);
    
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
    console.error("[Fast Auth] Error during auth check:", error);
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
