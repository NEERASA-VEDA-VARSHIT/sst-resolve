/**
 * Type definitions for user roles
 * 
 * IMPORTANT: Roles are stored in the DATABASE, not in Clerk metadata.
 * The database is the single source of truth for user roles.
 * 
 * Use getUserRoleFromDB() from @/lib/auth/db-roles to get user roles.
 */

export type UserRole = "super_admin" | "admin" | "committee" | "student";

/**
 * @deprecated Roles are now stored in database, not Clerk metadata
 * Use getUserRoleFromDB() from @/lib/auth/db-roles instead
 */
export interface SessionMetadata {
  role?: UserRole;
}

/**
 * @deprecated Roles are now stored in database, not Clerk metadata
 * Use getUserRoleFromDB() from @/lib/auth/db-roles instead
 */
export function getValidRole(metadata: SessionMetadata | undefined): UserRole {
  const allowedRoles: readonly UserRole[] = ["super_admin", "admin", "committee", "student"] as const;
  const role = metadata?.role;

  if (role && allowedRoles.includes(role)) {
    return role;
  }

  return "student";
}

/**
 * Gets the dashboard path for a given role
 */
export function getDashboardPath(role: UserRole): string {
  switch (role) {
    case "super_admin":
      return "/superadmin/dashboard";
    case "admin":
      return "/admin/dashboard";
    case "committee":
      return "/committee/dashboard";
    case "student":
    default:
      return "/student/dashboard";
  }
}
