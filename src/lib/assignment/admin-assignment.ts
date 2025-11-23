/**
 * Admin Assignment Utility
 * Handles determining which tickets an admin can see based on their domain/scope assignment
 */

import { db, users, roles, admin_assignments, domains, scopes } from "@/db";
import { eq, and, or, isNull } from "drizzle-orm";

export interface AdminAssignment {
  domain: string | null; // "Hostel" | "College" | null
  scope: string | null; // "Velankani" | "Neeladri" | null (for Hostel)
}

/**
 * Get admin's domain and scope assignment from users table (primary)
 * Role is checked via users.role_id
 */
export async function getAdminAssignment(clerkUserId: string): Promise<AdminAssignment> {
  try {
    const user = await db
      .select({
        primaryDomain: domains.name,
        primaryScope: scopes.name,
        roleName: roles.name,
      })
      .from(users)
      .leftJoin(roles, eq(users.role_id, roles.id))
      .leftJoin(domains, eq(users.primary_domain_id, domains.id))
      .leftJoin(scopes, eq(users.primary_scope_id, scopes.id))
      .where(eq(users.clerk_id, clerkUserId))
      .limit(1);

    if (user.length === 0 || !user[0].roleName) {
      return { domain: null, scope: null };
    }

    const userData = user[0];
    const validRoles = ["admin", "committee", "super_admin"];

    if (!userData.roleName || !validRoles.includes(userData.roleName)) {
      return { domain: null, scope: null };
    }

    return {
      domain: userData.primaryDomain || null,
      scope: userData.primaryScope || null,
    };
  } catch (error) {
    console.error("Error fetching admin assignment:", error);
    return { domain: null, scope: null };
  }
}

/**
 * Check if a ticket matches admin's domain/scope assignment
 */
export function ticketMatchesAdminAssignment(
  ticket: { category: string | null; location: string | null },
  assignment: AdminAssignment
): boolean {
  // If admin has no assignment configured, allow viewing
  if (!assignment.domain) {
    return true;
  }

  const ticketCategory = (ticket.category || "").toLowerCase();
  const ticketLocation = (ticket.location || "").toLowerCase();
  const assignmentDomain = (assignment.domain || "").toLowerCase();
  const assignmentScope = (assignment.scope || "").toLowerCase();

  // Match domain (category)
  if (!ticketCategory || ticketCategory !== assignmentDomain) {
    return false;
  }

  // For Hostel domain, also check scope (location)
  if (assignmentDomain === "hostel") {
    if (assignment.scope) {
      // Admin assigned to specific hostel, must match location
      if (!ticketLocation) return false;
      return ticketLocation === assignmentScope;
    } else {
      // Admin assigned to Hostel but no specific scope, can see all hostel tickets
      return true;
    }
  }

  // For College domain, no scope needed
  if (assignmentDomain === "college") {
    return true;
  }

  return false;
}

/**
 * Get all admin clerk user IDs for a specific domain/scope
 * Checks both primary assignments and secondary admin_assignments
 */
export async function getAdminsForDomainScope(
  domain: string,
  scope: string | null = null
): Promise<string[]> {
  try {
    // 1. Get admins with matching primary assignment
    const primaryQuery = db
      .select({
        clerk_id: users.clerk_id,
      })
      .from(users)
      .leftJoin(roles, eq(users.role_id, roles.id))
      .leftJoin(domains, eq(users.primary_domain_id, domains.id))
      .leftJoin(scopes, eq(users.primary_scope_id, scopes.id))
      .where(
        and(
          eq(domains.name, domain),
          or(
            eq(roles.name, "admin"),
            eq(roles.name, "committee"),
            eq(roles.name, "super_admin")
          ),
          scope ? eq(scopes.name, scope) : isNull(users.primary_scope_id)
        )
      );

    // 2. Get admins with matching secondary assignment
    const secondaryQuery = db
      .select({
        clerk_id: users.clerk_id,
      })
      .from(admin_assignments)
      .innerJoin(users, eq(admin_assignments.user_id, users.id))
      .innerJoin(domains, eq(admin_assignments.domain_id, domains.id))
      .leftJoin(scopes, eq(admin_assignments.scope_id, scopes.id))
      .where(
        and(
          eq(domains.name, domain),
          scope ? eq(scopes.name, scope) : isNull(admin_assignments.scope_id)
        )
      );

    const [primaryAdmins, secondaryAdmins] = await Promise.all([
      primaryQuery,
      secondaryQuery
    ]);

    const allAdminIds = [
      ...primaryAdmins.map(a => a.clerk_id),
      ...secondaryAdmins.map(a => a.clerk_id)
    ];

    // Deduplicate
    return Array.from(new Set(allAdminIds)).filter((id): id is string => id !== null);

  } catch (error) {
    console.error("Error fetching admins for domain/scope:", error);
    return [];
  }
}

/**
 * Get domains for categories that an admin is assigned to
 * Checks both category_assignments and categories.default_admin_id
 */
export async function getAdminAssignedCategoryDomains(
  adminUserId: string
): Promise<string[]> {
  try {
    const { category_assignments, categories: categoriesTable } = await import("@/db");
    
    // 1. Get domains from category_assignments
    const assignedCategories = await db
      .select({
        domainName: domains.name,
      })
      .from(category_assignments)
      .innerJoin(categoriesTable, eq(category_assignments.category_id, categoriesTable.id))
      .innerJoin(domains, eq(categoriesTable.domain_id, domains.id))
      .where(eq(category_assignments.user_id, adminUserId));

    // 2. Get domains from categories where admin is default_admin_id
    const defaultAdminCategories = await db
      .select({
        domainName: domains.name,
      })
      .from(categoriesTable)
      .innerJoin(domains, eq(categoriesTable.domain_id, domains.id))
      .where(eq(categoriesTable.default_admin_id, adminUserId));

    // Combine and deduplicate
    const allDomains = [
      ...assignedCategories.map(c => c.domainName),
      ...defaultAdminCategories.map(c => c.domainName)
    ];

    return Array.from(new Set(allDomains)).filter((name): name is string => name !== null);
  } catch (error) {
    console.error("Error fetching admin assigned category domains:", error);
    return [];
  }
}