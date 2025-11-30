/**
 * Database Role Management
 * Single-role system per user (users.role_id)
 * Supports: scoped access via primary_domain/scope and admin_assignments
 */

import { db, users, roles, domains, scopes, admin_assignments, admin_profiles } from "@/db";
import { eq, and } from "drizzle-orm";
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
 * Used to determine hierarchy
 */
const ROLE_PRIORITY: Record<UserRole, number> = {
  super_admin: 5,
  admin: 3,
  committee: 2,
  student: 1,
};

/**
 * In-memory cache for role IDs to avoid repeated DB queries
 */
interface RoleCacheEntry {
  id: number;
  expiresAt: number;
}

const roleCache = new Map<string, RoleCacheEntry>();
const ROLE_CACHE_TTL = 60 * 1000; // 60 seconds
const ROLE_CACHE_MAX_SIZE = 100;

/**
 * In-memory cache for user role lookups
 */
interface UserRoleCacheEntry {
  role: UserRole;
  expiresAt: number;
}

const userRoleCache = new Map<string, UserRoleCacheEntry>();
const USER_ROLE_CACHE_TTL = 5 * 1000; // 5 seconds
const USER_ROLE_CACHE_MAX_SIZE = 1000;

// Export cache for manual invalidation
export { userRoleCache };

export function invalidateUserRoleCache(clerkUserId: string): void {
  userRoleCache.delete(clerkUserId);
}

function getRoleFromCache(name: string): number | undefined {
  const entry = roleCache.get(name);
  if (!entry) return undefined;

  if (entry.expiresAt < Date.now()) {
    roleCache.delete(name);
    return undefined;
  }

  return entry.id;
}

function setRoleInCache(name: string, id: number): void {
  if (roleCache.size >= ROLE_CACHE_MAX_SIZE) {
    const firstKey = roleCache.keys().next().value;
    if (firstKey) roleCache.delete(firstKey);
  }

  roleCache.set(name, {
    id,
    expiresAt: Date.now() + ROLE_CACHE_TTL,
  });
}

function getUserRoleFromCache(clerkUserId: string): UserRole | undefined {
  const entry = userRoleCache.get(clerkUserId);
  if (!entry) return undefined;

  if (entry.expiresAt < Date.now()) {
    userRoleCache.delete(clerkUserId);
    return undefined;
  }

  return entry.role;
}

function setUserRoleInCache(clerkUserId: string, role: UserRole): void {
  if (userRoleCache.size >= USER_ROLE_CACHE_MAX_SIZE) {
    const firstKey = userRoleCache.keys().next().value;
    if (firstKey) userRoleCache.delete(firstKey);
  }

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
 */
export async function getOrCreateRole(roleName: UserRole): Promise<number> {
  const name = ROLE_NAMES[roleName];

  const cachedId = getRoleFromCache(name);
  if (cachedId !== undefined) return cachedId;

  const [existingRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.name, name))
    .limit(1);

  if (existingRole) {
    setRoleInCache(name, existingRole.id);
    return existingRole.id;
  }

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
  } catch (err: unknown) {
    type DbError = {
      code?: string;
    };
    const dbError = err as DbError;
    if (dbError?.code === "23505") {
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
    console.error("[DB Roles] Error creating role:", err);
    throw err;
  }
}

/**
 * Get role ID without creating it
 */
export async function getRoleId(roleName: UserRole): Promise<number | null> {
  const name = ROLE_NAMES[roleName];

  const cachedId = getRoleFromCache(name);
  if (cachedId !== undefined) return cachedId;

  const [existingRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.name, name))
    .limit(1);

  if (!existingRole) return null;

  setRoleInCache(name, existingRole.id);
  return existingRole.id;
}

/**
 * Get user's primary role from database
 */
export async function getUserRoleFromDB(clerkUserId: string): Promise<UserRole> {
  try {
    const cachedRole = getUserRoleFromCache(clerkUserId);

    if (cachedRole && ROLE_NAMES[cachedRole]) {
      if (cachedRole === "student") return cachedRole;
    }

    const [user] = await db
      .select({
        roleName: roles.name,
      })
      .from(users)
      .leftJoin(roles, eq(users.role_id, roles.id))
      .where(
        and(
          eq(users.auth_provider, 'clerk'),
          eq(users.external_id, clerkUserId)
        )
      )
      .limit(1);

    if (!user || !user.roleName) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[DB Roles] User ${clerkUserId} not found or has no role, defaulting to student`);
      }
      return "student";
    }

    const roleName = user.roleName as UserRole;
    setUserRoleInCache(clerkUserId, roleName);

    return roleName;
  } catch (error) {
    console.error("[DB Roles] Error getting user role:", error);
    return "student";
  }
}

/**
 * Get all roles for a user (including scoped assignments)
 * Maps the single user role + admin assignments to the old array format
 */
export async function getUserRoles(clerkUserId: string): Promise<Array<{
  role: UserRole;
  domain: string | null;
  scope: string | null;
}>> {
  try {
    const [userData] = await db
      .select({
        user: users,
        role: roles,
        primaryDomain: domains,
        primaryScope: scopes,
      })
      .from(users)
      .leftJoin(roles, eq(users.role_id, roles.id))
      .leftJoin(admin_profiles, eq(admin_profiles.user_id, users.id))
      .leftJoin(domains, eq(admin_profiles.primary_domain_id, domains.id))
      .leftJoin(scopes, eq(admin_profiles.primary_scope_id, scopes.id))
      .where(
        and(
          eq(users.auth_provider, 'clerk'),
          eq(users.external_id, clerkUserId)
        )
      )
      .limit(1);

    if (!userData || !userData.role) {
      return [];
    }

    const roleName = userData.role.name as UserRole;
    const results: Array<{ role: UserRole; domain: string | null; scope: string | null }> = [];

    // 1. Add primary role/domain/scope
    results.push({
      role: roleName,
      domain: userData.primaryDomain?.name || null,
      scope: userData.primaryScope?.name || null,
    });

    // 2. Fetch admin assignments for extra scopes
    const assignments = await db
      .select({
        domainName: domains.name,
        scopeName: scopes.name,
      })
      .from(admin_assignments)
      .leftJoin(domains, eq(admin_assignments.domain_id, domains.id))
      .leftJoin(scopes, eq(admin_assignments.scope_id, scopes.id))
      .where(eq(admin_assignments.user_id, userData.user.id));

    // Add assignments as same role but different scope
    // (Since role is now user-level, it applies to all assignments)
    for (const assignment of assignments) {
      if (assignment.domainName) {
        results.push({
          role: roleName,
          domain: assignment.domainName,
          scope: assignment.scopeName || null,
        });
      }
    }

    return results;
  } catch (error) {
    console.error("[DB Roles] Error getting user roles:", error);
    return [];
  }
}

/**
 * Set user's role in database
 * Updates users.role_id and optionally admin_profiles.primary_domain_id/primary_scope_id
 */
export async function setUserRole(
  clerkUserId: string,
  roleName: UserRole,
  options?: {
    domain?: string | null;
    scope?: string | null;
    grantedBy?: string;
  }
): Promise<void> {
  try {
    if (!ROLE_NAMES[roleName]) {
      throw new Error(`Invalid role: ${roleName}`);
    }

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.auth_provider, 'clerk'),
          eq(users.external_id, clerkUserId)
        )
      )
      .limit(1);

    if (!user) {
      throw new Error(`User ${clerkUserId} not found`);
    }

    const roleId = await getOrCreateRole(roleName);

    // Resolve domain/scope IDs if provided
    let domainId: number | null = null;
    let scopeId: number | null = null;

    if (options?.domain) {
      const [d] = await db.select({ id: domains.id }).from(domains).where(eq(domains.name, options.domain)).limit(1);
      if (d) domainId = d.id;
    }

    if (options?.scope) {
      const [s] = await db.select({ id: scopes.id }).from(scopes).where(eq(scopes.name, options.scope)).limit(1);
      if (s) scopeId = s.id;
    }

    // Update user record
    await db.update(users)
      .set({
        role_id: roleId,
      })
      .where(eq(users.id, user.id));

    // Update or create admin profile with primary domain/scope
    if (roleName === "admin" || roleName === "super_admin") {
      const { admin_profiles } = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");
      
      // Check if admin profile exists
      const [existingProfile] = await db
        .select({ user_id: admin_profiles.user_id })
        .from(admin_profiles)
        .where(eq(admin_profiles.user_id, user.id))
        .limit(1);

      if (existingProfile) {
        // Update existing profile
        await db.update(admin_profiles)
          .set({
            primary_domain_id: domainId,
            primary_scope_id: scopeId,
            updated_at: new Date(),
          })
          .where(eq(admin_profiles.user_id, user.id));
      } else {
        // Create new profile
        await db.insert(admin_profiles).values({
          user_id: user.id,
          primary_domain_id: domainId,
          primary_scope_id: scopeId,
          slack_user_id: "", // Default empty string - can be updated later
        });
      }
    }

    // If promoting to admin or super_admin, delete student record if it exists
    // Admins and super_admins are not students, so their student record should be removed
    // Note: Student records are only created when explicitly needed (via admin form/bulk upload),
    // so a new staff member who logs in won't have a student record - that's fine!
    if (roleName === "admin" || roleName === "super_admin") {
      try {
        const { students } = await import("@/db/schema");
        const { eq } = await import("drizzle-orm");
        
        // Check if student record exists before deleting
        const [existingStudent] = await db
          .select({ id: students.id })
          .from(students)
          .where(eq(students.user_id, user.id))
          .limit(1);
        
        if (existingStudent) {
          await db.delete(students)
            .where(eq(students.user_id, user.id));
          
          if (process.env.NODE_ENV !== "production") {
            console.log(`[DB Roles] Deleted student record for user ${clerkUserId} after promoting to ${roleName}`);
          }
        } else {
          // No student record exists - this is fine for new staff members
          if (process.env.NODE_ENV !== "production") {
            console.log(`[DB Roles] No student record found for user ${clerkUserId} - skipping deletion (user is new staff member)`);
          }
        }
      } catch (error) {
        // Don't fail the role update if student deletion fails
        console.warn(`[DB Roles] Failed to delete student record for user ${clerkUserId}:`, error);
      }
    }

    userRoleCache.delete(clerkUserId);

    if (process.env.NODE_ENV !== "production") {
      console.log(`[DB Roles] Set role "${roleName}" for user ${clerkUserId}`);
    }
  } catch (error) {
    console.error("[DB Roles] Error setting user role:", error);
    throw error;
  }
}

/**
 * Remove a role from a user
 * Effectively demotes to 'student' and clears primary domain/scope
 */
export async function removeUserRole(
  clerkUserId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _roleName: UserRole, // kept for API compatibility, but we just demote the user
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _options?: {
    domain?: string | null;
    scope?: string | null;
  }
): Promise<void> {
  try {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.auth_provider, 'clerk'),
          eq(users.external_id, clerkUserId)
        )
      )
      .limit(1);

    if (!user) {
      throw new Error(`User ${clerkUserId} not found`);
    }

    // If we are "removing" the role, we set them back to student
    const studentRoleId = await getOrCreateRole("student");

    await db.update(users)
      .set({
        role_id: studentRoleId,
      })
      .where(eq(users.id, user.id));

    // Clear admin profile primary domain/scope
    const [existingProfile] = await db
      .select({ user_id: admin_profiles.user_id })
      .from(admin_profiles)
      .where(eq(admin_profiles.user_id, user.id))
      .limit(1);

    if (existingProfile) {
      await db.update(admin_profiles)
        .set({
          primary_domain_id: null,
          primary_scope_id: null,
          updated_at: new Date(),
        })
        .where(eq(admin_profiles.user_id, user.id));
    }

    // Also clear admin assignments? 
    // Probably yes if they are no longer admin.
    await db.delete(admin_assignments).where(eq(admin_assignments.user_id, user.id));

    userRoleCache.delete(clerkUserId);

    if (process.env.NODE_ENV !== "production") {
      console.log(`[DB Roles] Demoted user ${clerkUserId} to student`);
    }
  } catch (error) {
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
    const [userData] = await db
      .select({
        user: users,
        role: roles,
        primaryDomain: domains,
        primaryScope: scopes,
      })
      .from(users)
      .leftJoin(roles, eq(users.role_id, roles.id))
      .leftJoin(admin_profiles, eq(admin_profiles.user_id, users.id))
      .leftJoin(domains, eq(admin_profiles.primary_domain_id, domains.id))
      .leftJoin(scopes, eq(admin_profiles.primary_scope_id, scopes.id))
      .where(
        and(
          eq(users.auth_provider, 'clerk'),
          eq(users.external_id, clerkUserId)
        )
      )
      .limit(1);

    if (!userData || !userData.role) {
      return false;
    }

    const userRoleName = userData.role.name as UserRole;

    // 1. Check Role Hierarchy
    // If user is super_admin, they have access to everything
    if (userRoleName === "super_admin") return true;

    // If the requested role is higher priority than user's role, return false
    if (ROLE_PRIORITY[userRoleName] < ROLE_PRIORITY[roleName]) {
      return false;
    }

    // 2. Check Domain/Scope if requested
    if (options?.domain) {
      // Check primary domain
      if (userData.primaryDomain?.name === options.domain) {
        if (!options.scope) return true; // Domain match, no scope requested
        if (userData.primaryScope?.name === options.scope) return true; // Scope match
      }

      // Check admin assignments
      const [assignment] = await db
        .select({ id: admin_assignments.id })
        .from(admin_assignments)
        .leftJoin(domains, eq(admin_assignments.domain_id, domains.id))
        .leftJoin(scopes, eq(admin_assignments.scope_id, scopes.id))
        .where(and(
          eq(admin_assignments.user_id, userData.user.id),
          eq(domains.name, options.domain),
          options.scope ? eq(scopes.name, options.scope) : undefined
        ))
        .limit(1);

      if (assignment) return true;

      return false; // Domain requested but not found in primary or assignments
    }

    return true; // Role matched and no specific domain requested
  } catch (error) {
    console.error("[DB Roles] Error checking user role:", error);
    return false;
  }
}

/**
 * Ensure all default roles exist in database
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
