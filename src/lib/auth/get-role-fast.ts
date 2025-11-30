/**
 * Fast Role Lookup for Middleware
 * 
 * Direct database query optimized for Edge runtime
 * Avoids internal API calls which can cause issues in production
 * Includes 30-second cache to reduce database load and timeout frequency
 */

import { db } from "@/db";
import { users, roles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { UserRole } from "@/types/auth";

/**
 * In-memory cache for role lookups (30-second TTL)
 * Safe for Edge runtime - reduces DB queries significantly
 * Increased from 10s to 30s to reduce database load and timeout frequency
 */
const roleCache = new Map<string, { role: UserRole | null; expires: number }>();

/**
 * Get user's role directly from database with caching
 * Optimized for middleware use (fast, no API calls)
 * 
 * @param clerkId - Clerk user ID
 * @returns UserRole or null if not found
 */
export async function getRoleFast(clerkId: string): Promise<UserRole | null> {
  const now = Date.now();
  const cached = roleCache.get(clerkId);

  // Return cached role if still valid
  if (cached && cached.expires > now) {
    return cached.role;
  }

  try {
    // Get role for this user (single role per user now)
    const [result] = await db
      .select({
        roleName: roles.name
      })
      .from(users)
      .leftJoin(roles, eq(users.role_id, roles.id))
      .where(
        and(
          eq(users.auth_provider, 'clerk'),
          eq(users.external_id, clerkId)
        )
      )
      .limit(1);

    let role: UserRole | null = null;

    if (result && result.roleName) {
      const validRoles: UserRole[] = ["student", "admin", "super_admin", "committee"];
      if (validRoles.includes(result.roleName as UserRole)) {
        role = result.roleName as UserRole;
      }
    }

    // Cache for 30 seconds to reduce database load
    roleCache.set(clerkId, {
      role,
      expires: now + 30_000
    });

    return role;
  } catch {
    // Edge runtime database error (expected with postgres-js driver)
    // Middleware catches this and falls back to page-level authorization
    // Only log in development to avoid noise in production logs
    if (process.env.NODE_ENV === 'development') {
      console.warn("[getRoleFast] DB query failed (Edge runtime) - fallback to page auth");
    }

    // On error, cache null for 30 seconds to avoid hammering DB
    roleCache.set(clerkId, {
      role: null,
      expires: now + 30_000
    });

    return null;
  }
}