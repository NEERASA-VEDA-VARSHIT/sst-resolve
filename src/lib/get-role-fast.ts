/**
 * Fast Role Lookup for Middleware
 * 
 * Direct database query optimized for Edge runtime
 * Avoids internal API calls which can cause issues in production
 * Includes 10-second cache to reduce database load
 */

import { db } from "@/db";
import { users, user_roles, roles } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { UserRole } from "@/types/auth";

/**
 * In-memory cache for role lookups (10-second TTL)
 * Safe for Edge runtime - reduces DB queries significantly
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
    // Get ALL roles for this user (they might have multiple)
    const result = await db
      .select({ 
        roleName: roles.name 
      })
      .from(users)
      .innerJoin(user_roles, eq(user_roles.user_id, users.id))
      .innerJoin(roles, eq(user_roles.role_id, roles.id))
      .where(eq(users.clerk_id, clerkId));

    let role: UserRole | null = null;

    if (result.length > 0) {
      // If user has multiple roles, pick the highest priority one
      const rolePriority: Record<UserRole, number> = {
        super_admin: 5,
        
        admin: 3,
        committee: 2,
        student: 1,
      };

      const validRoles: UserRole[] = ["student", "admin", "super_admin", "committee"];
      let highestPriority = -1;

      for (const row of result) {
        const roleName = row.roleName;
        if (validRoles.includes(roleName as UserRole)) {
          const priority = rolePriority[roleName as UserRole];
          if (priority > highestPriority) {
            highestPriority = priority;
            role = roleName as UserRole;
          }
        }
      }
    }

    // Cache for 10 seconds
    roleCache.set(clerkId, { 
      role, 
      expires: now + 10_000 
    });

    return role;
  } catch (error) {
    // Edge runtime database error (expected with postgres-js driver)
    // Middleware catches this and falls back to page-level authorization
    // Only log in development to avoid noise in production logs
    if (process.env.NODE_ENV === 'development') {
      console.warn("[getRoleFast] DB query failed (Edge runtime) - fallback to page auth");
    }
    
    // On error, cache null for 10 seconds to avoid hammering DB
    roleCache.set(clerkId, { 
      role: null, 
      expires: now + 10_000 
    });
    
    return null;
  }
}