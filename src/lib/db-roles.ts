/**
 * Database Role Management
 * Multi-role system using user_roles join table
 * Supports: multi-role, scoped roles, time-bound roles, flexible RBAC
 */

import { db, users, roles, user_roles } from "@/db";
import { eq, and, isNull } from "drizzle-orm";
import type { UserRole } from "@/types/auth";

/**
 * Role name mapping to match UserRole type
 */
const ROLE_NAMES: Record<UserRole, string> = {
  student: "student",
  admin: "admin",
  
  super_admin: "super_admin",
  committee: "committee",
};

// Export for admin UI dropdowns and tooling (prevents duplication)
export { ROLE_NAMES };

/**
 * Role priority (higher = more privileged)
 * Used to determine primary role when user has multiple roles
 */
const ROLE_PRIORITY: Record<UserRole, number> = {
  super_admin: 5,
  
  admin: 3,
  committee: 2,
  student: 1,
};

/**
 * In-memory cache for role IDs to avoid repeated DB queries
 * Note: This is a process-local cache for serverless optimization
 * In distributed environments, each instance has its own cache
 */
interface RoleCacheEntry {
  id: number;
  expiresAt: number;
}

const roleCache = new Map<string, RoleCacheEntry>();
const ROLE_CACHE_TTL = 60 * 1000; // 60 seconds
const ROLE_CACHE_MAX_SIZE = 100; // Prevent unbounded growth

/**
 * In-memory cache for user role lookups
 * Caches the result of getUserRoleFromDB() to avoid expensive join queries
 */
interface UserRoleCacheEntry {
  role: UserRole;
  expiresAt: number;
}

const userRoleCache = new Map<string, UserRoleCacheEntry>();
const USER_ROLE_CACHE_TTL = 5 * 1000; // 5 seconds (shorter TTL for more critical data)
const USER_ROLE_CACHE_MAX_SIZE = 1000; // Allow more user entries

// Export cache for manual invalidation in edge cases (e.g., auto-linking)
export { userRoleCache };

/**
 * Invalidate user role cache (for cross-module consistency)
 * Use this instead of directly accessing userRoleCache
 * Ensures cache invalidation works across serverless instances
 */
export function invalidateUserRoleCache(clerkUserId: string): void {
  userRoleCache.delete(clerkUserId);
}

/**
 * Get role ID from cache with TTL checking
 */
function getRoleFromCache(name: string): number | undefined {
  const entry = roleCache.get(name);
  if (!entry) return undefined;
  
  // Check if expired
  if (entry.expiresAt < Date.now()) {
    roleCache.delete(name);
    return undefined;
  }
  
  return entry.id;
}

/**
 * Set role ID in cache with TTL and size limit
 */
function setRoleInCache(name: string, id: number): void {
  // Simple eviction: remove oldest entry if at max size
  if (roleCache.size >= ROLE_CACHE_MAX_SIZE) {
    const firstKey = roleCache.keys().next().value;
    if (firstKey) {
      roleCache.delete(firstKey);
    }
  }
  
  roleCache.set(name, {
    id,
    expiresAt: Date.now() + ROLE_CACHE_TTL,
  });
}

/**
 * Get user role from cache with TTL checking
 */
function getUserRoleFromCache(clerkUserId: string): UserRole | undefined {
  const entry = userRoleCache.get(clerkUserId);
  if (!entry) return undefined;
  
  // Check if expired
  if (entry.expiresAt < Date.now()) {
    userRoleCache.delete(clerkUserId);
    return undefined;
  }
  
  return entry.role;
}

/**
 * Set user role in cache with TTL and size limit
 */
function setUserRoleInCache(clerkUserId: string, role: UserRole): void {
  // Simple eviction: remove oldest entry if at max size
  if (userRoleCache.size >= USER_ROLE_CACHE_MAX_SIZE) {
    const firstKey = userRoleCache.keys().next().value;
    if (firstKey) {
      userRoleCache.delete(firstKey);
    }
  }
  
  // Force clear if approaching ceiling (serverless safety)
  // Prevents unbounded growth in high-traffic scenarios
  if (userRoleCache.size > USER_ROLE_CACHE_MAX_SIZE * 0.9) {
    userRoleCache.clear();
  }
  
  userRoleCache.set(clerkUserId, {
    role,
    expiresAt: Date.now() + USER_ROLE_CACHE_TTL,
  });
}

/**
 * Get or create a role by name
 * Ensures role exists in database
 * Uses in-memory cache with TTL to avoid repeated queries
 * Handles race conditions when multiple processes create the same role
 */
export async function getOrCreateRole(roleName: UserRole): Promise<number> {
  const name = ROLE_NAMES[roleName];
  
  // Check cache first (with TTL)
  const cachedId = getRoleFromCache(name);
  if (cachedId !== undefined) {
    return cachedId;
  }
  
  // Try to find existing role in database
  const [existingRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.name, name))
    .limit(1);

  if (existingRole) {
    setRoleInCache(name, existingRole.id);
    return existingRole.id;
  }

  // Create role if it doesn't exist (with race condition handling)
  try {
    const [newRole] = await db
      .insert(roles)
      .values({
        name,
        description: `Role for ${name}`,
      })
      .returning({ id: roles.id });

    setRoleInCache(name, newRole.id);
    return newRole.id;
  } catch (err: any) {
    // Handle race condition: another process created the role simultaneously
    // PostgreSQL unique constraint violation code: 23505
    if (err?.code === "23505") {
      // Re-read the role that was created by the other process
      const [existingRole2] = await db
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.name, name))
        .limit(1);

      if (existingRole2) {
        setRoleInCache(name, existingRole2.id);
        return existingRole2.id;
      }
    }
    
    // Re-throw if it's not a race condition or recovery failed
    // Always log errors, even in production
    console.error("[DB Roles] Error creating role:", err);
    throw err;
  }
}

/**
 * Get role ID without creating it (read-only)
 * Used for access checks where we should NOT create missing roles
 * 
 * @param roleName - The role to look up
 * @returns Role ID or null if role doesn't exist
 */
export async function getRoleId(roleName: UserRole): Promise<number | null> {
  const name = ROLE_NAMES[roleName];
  
  // Check cache first (with TTL)
  const cachedId = getRoleFromCache(name);
  if (cachedId !== undefined) {
    return cachedId;
  }
  
  // Query database (read-only, no creation)
  const [existingRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.name, name))
    .limit(1);

  if (!existingRole) {
    return null; // Role doesn't exist
  }

  // Cache the found role
  setRoleInCache(name, existingRole.id);
  return existingRole.id;
}

/**
 * Get user's primary role from database
 * Returns the highest priority role if user has multiple roles
 * Returns "student" as default if no roles found
 * Includes caching to reduce expensive join queries
 */
export async function getUserRoleFromDB(clerkUserId: string): Promise<UserRole> {
  try {
    // Check cache first (5-second TTL)
    const cachedRole = getUserRoleFromCache(clerkUserId);
    
    // CRITICAL SECURITY: Only trust cache for "student" role
    // Elevated roles (admin, super_admin, etc.) MUST always revalidate from DB
    // This prevents privilege escalation from stale cache after demotion
    if (cachedRole && ROLE_NAMES[cachedRole]) {
      if (cachedRole === "student") {
        // Student is default/lowest privilege - safe to cache
        return cachedRole;
      }
      // For all other roles, fall through to DB query (security-critical)
    }

    // Get user first (explicit typing for safety)
    const userResult: Array<{ id: string }> = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_id, clerkUserId))
      .limit(1);

    const user = userResult[0];

    if (!user) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[DB Roles] User ${clerkUserId} not found in database`);
      }
      return "student";
    }

    // Get all roles for this user
    const userRoles: Array<{ roleName: string }> = await db
      .select({
        roleName: roles.name,
      })
      .from(user_roles)
      .innerJoin(roles, eq(user_roles.role_id, roles.id))
      .where(eq(user_roles.user_id, user.id));

    if (userRoles.length === 0) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[DB Roles] User ${clerkUserId} has no roles assigned, defaulting to student`);
      }
      const defaultRole: UserRole = "student";
      setUserRoleInCache(clerkUserId, defaultRole);
      return defaultRole;
    }

    // Find highest priority role with strict validation
    const validRoles: UserRole[] = ["student", "admin", "super_admin", "committee"];
    let highestPriority = -1;
    let primaryRole: UserRole = "student";

    for (const userRole of userRoles) {
      const roleName = userRole.roleName;
      
      // Validate before casting to UserRole
      if (validRoles.includes(roleName as UserRole)) {
        const priority = ROLE_PRIORITY[roleName as UserRole];
        if (priority > highestPriority) {
          highestPriority = priority;
          primaryRole = roleName as UserRole;
        }
      } else {
        // Log invalid roles in development only
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[DB Roles] Invalid role name "${roleName}" found for user ${clerkUserId}`);
        }
      }
    }

    // Cache the computed role
    setUserRoleInCache(clerkUserId, primaryRole);
    
    return primaryRole;
  } catch (error) {
    // Always log errors, even in production
    console.error("[DB Roles] Error getting user role:", error);
    return "student";
  }
}

/**
 * Get all roles for a user (with scoping information)
 */
export async function getUserRoles(clerkUserId: string): Promise<Array<{
  role: UserRole;
  domain: string | null;
  scope: string | null;
}>> {
  try {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_id, clerkUserId))
      .limit(1);

    if (!user) {
      return [];
    }

    const userRolesList = await db
      .select({
        roleName: roles.name,
        domain: user_roles.domain,
        scope: user_roles.scope,
      })
      .from(user_roles)
      .innerJoin(roles, eq(user_roles.role_id, roles.id))
      .where(eq(user_roles.user_id, user.id));

    const validRoles: UserRole[] = ["student", "admin", "super_admin", "committee"];
    
    return userRolesList
      .filter(ur => validRoles.includes(ur.roleName as UserRole))
      .map(ur => ({
        role: ur.roleName as UserRole,
        domain: ur.domain,
        scope: ur.scope,
      }));
  } catch (error) {
    // Always log errors, even in production
    console.error("[DB Roles] Error getting user roles:", error);
    return [];
  }
}

/**
 * Set user's role in database (adds role to user_roles table)
 * Supports scoped roles via domain/scope parameters
 */
export async function setUserRole(
  clerkUserId: string,
  roleName: UserRole,
  options?: {
    domain?: string | null;
    scope?: string | null;
    grantedBy?: string; // Clerk ID of user granting this role
  }
): Promise<void> {
  try {
    // Validate role name before proceeding
    if (!ROLE_NAMES[roleName]) {
      throw new Error(`Invalid role: ${roleName}`);
    }

    const userResult: Array<{ id: string }> = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_id, clerkUserId))
      .limit(1);

    const user = userResult[0];

    if (!user) {
      throw new Error(`User ${clerkUserId} not found`);
    }

    const roleId = await getOrCreateRole(roleName);

    // Get granted_by user_id if provided
    let grantedById: string | null = null;
    if (options?.grantedBy) {
      const grantedByResult: Array<{ id: string }> = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerk_id, options.grantedBy))
        .limit(1);
      
      const grantedByUser = grantedByResult[0];
      if (grantedByUser) {
        grantedById = grantedByUser.id;
      }
    }

    // Check if role already exists for this user/domain/scope combination
    // IMPORTANT: Always include base conditions to prevent empty and() calls
    const conditions = [
      eq(user_roles.user_id, user.id),
      eq(user_roles.role_id, roleId),
    ];

    if (options?.domain !== undefined) {
      conditions.push(
        options.domain === null
          ? isNull(user_roles.domain)
          : eq(user_roles.domain, options.domain)
      );
    }

    if (options?.scope !== undefined) {
      conditions.push(
        options.scope === null
          ? isNull(user_roles.scope)
          : eq(user_roles.scope, options.scope)
      );
    }

    const existingRole = await db
      .select()
      .from(user_roles)
      .where(and(...conditions))
      .limit(1);

    if (existingRole.length > 0) {
      // Role already exists, skip (idempotent operation)
      return;
    }

    // Insert new role assignment
    await db.insert(user_roles).values({
      user_id: user.id,
      role_id: roleId,
      domain: options?.domain || null,
      scope: options?.scope || null,
      granted_by: grantedById,
    });
    
    // CRITICAL: Invalidate user role cache after mutation
    userRoleCache.delete(clerkUserId);
    
    // Log only in development/staging
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DB Roles] Assigned role "${roleName}" to user ${clerkUserId}${options?.domain ? ` (domain: ${options.domain})` : ''}${options?.scope ? ` (scope: ${options.scope})` : ''}`);
    }
  } catch (error) {
    // Always log errors, even in production
    console.error("[DB Roles] Error setting user role:", error);
    throw error;
  }
}

/**
 * Remove a role from a user
 */
export async function removeUserRole(
  clerkUserId: string,
  roleName: UserRole,
  options?: {
    domain?: string | null;
    scope?: string | null;
  }
): Promise<void> {
  try {
    // Validate role name before proceeding
    if (!ROLE_NAMES[roleName]) {
      throw new Error(`Invalid role: ${roleName}`);
    }

    const userResult: Array<{ id: string }> = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_id, clerkUserId))
      .limit(1);

    const user = userResult[0];

    if (!user) {
      throw new Error(`User ${clerkUserId} not found`);
    }

    const roleId = await getOrCreateRole(roleName);

    // Build conditions array for delete operation
    // IMPORTANT: Always include base conditions to prevent empty and() calls
    const conditions = [
      eq(user_roles.user_id, user.id),
      eq(user_roles.role_id, roleId),
    ];

    if (options?.domain !== undefined) {
      conditions.push(
        options.domain === null
          ? isNull(user_roles.domain)
          : eq(user_roles.domain, options.domain)
      );
    }

    if (options?.scope !== undefined) {
      conditions.push(
        options.scope === null
          ? isNull(user_roles.scope)
          : eq(user_roles.scope, options.scope)
      );
    }

    // Delete role assignment
    await db
      .delete(user_roles)
      .where(and(...conditions));
    
    // CRITICAL: Invalidate user role cache after mutation
    userRoleCache.delete(clerkUserId);
      
    // Log only in development/staging
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DB Roles] Removed role "${roleName}" from user ${clerkUserId}${options?.domain ? ` (domain: ${options.domain})` : ''}${options?.scope ? ` (scope: ${options.scope})` : ''}`);
    }
  } catch (error) {
    // Always log errors, even in production
    console.error("[DB Roles] Error removing user role:", error);
    throw error;
  }
}

/**
 * Check if user has a specific role (optionally scoped)
 */
export async function userHasRole(
  clerkUserId: string,
  roleName: UserRole,
  options?: {
    domain?: string | null;
    scope?: string | null;
  }
): Promise<boolean> {
  try {
    const userResult: Array<{ id: string }> = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_id, clerkUserId))
      .limit(1);

    const user = userResult[0];

    if (!user) {
      return false;
    }

    // Use getRoleId() instead of getOrCreateRole() - don't create roles during access checks
    const roleId = await getRoleId(roleName);
    
    if (!roleId) {
      // Role doesn't exist in database, user can't have it
      return false;
    }

    // Build conditions array to avoid undefined in and()
    // IMPORTANT: Always include at least the base conditions to prevent empty and() calls
    const conditions = [
      eq(user_roles.user_id, user.id),
      eq(user_roles.role_id, roleId),
    ];

    if (options?.domain !== undefined) {
      conditions.push(
        options.domain === null
          ? isNull(user_roles.domain)
          : eq(user_roles.domain, options.domain)
      );
    }

    if (options?.scope !== undefined) {
      conditions.push(
        options.scope === null
          ? isNull(user_roles.scope)
          : eq(user_roles.scope, options.scope)
      );
    }

    // Defensive check: ensure we never call and() with empty array
    if (conditions.length === 0) {
      // Always log errors, even in production
      console.error("[DB Roles] Empty conditions array in userHasRole");
      return false;
    }

    const result = await db
      .select()
      .from(user_roles)
      .where(and(...conditions))
      .limit(1);

    return result.length > 0;
  } catch (error) {
    // Always log errors, even in production
    console.error("[DB Roles] Error checking user role:", error);
    return false;
  }
}

/**
 * Ensure all default roles exist in database
 * Should be called once on startup or in deployment script
 * Prevents silent failures when checking for missing roles
 */
export async function ensureDefaultRolesExist(): Promise<void> {
  try {
    const roleNames = Object.keys(ROLE_NAMES) as UserRole[];
    
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DB Roles] Ensuring ${roleNames.length} default roles exist...`);
    }
    
    for (const role of roleNames) {
      await getOrCreateRole(role);
    }
    
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DB Roles] All default roles verified`);
    }
  } catch (error) {
    console.error("[DB Roles] Error ensuring default roles exist:", error);
    throw error;
  }
}
