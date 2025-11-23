/**
 * Database Helper Functions
 * Optimized queries for common operations
 */

import { db, users, roles, admin_assignments, tickets, committee_members, categories, ticket_statuses, domains, scopes } from "@/db";
import { eq, and, isNull, isNotNull, lt, sql } from "drizzle-orm";
import type { UserRole } from "@/types/auth";

/**
 * Find a super admin user's clerk_id from database
 * Returns the first super admin found, or null if none exists
 * Uses database as single source of truth (not Clerk metadata)
 */
export async function findSuperAdminClerkId(): Promise<string | null> {
  try {
    const superAdminUsers = await db
      .select({
        clerk_id: users.clerk_id,
      })
      .from(users)
      .innerJoin(roles, eq(users.role_id, roles.id))
      .where(eq(roles.name, "super_admin"))
      .limit(1);

    return superAdminUsers[0]?.clerk_id || null;
  } catch (error) {
    console.error("[DB Helpers] Error finding super admin:", error);
    return null;
  }
}

/**
 * Get all roles for a user (with scoping information)
 * Returns array of roles with domain/scope context
 */
export async function getUserRoles(clerkUserId: string): Promise<Array<{
  role: UserRole;
  domain: string | null;
  scope: string | null;
}>> {
  try {
    const { getUserRoles: getRoles } = await import("@/lib/auth/db-roles");
    return await getRoles(clerkUserId);
  } catch (error) {
    console.error("[DB Helpers] Error getting user roles:", error);
    return [];
  }
}

/**
 * Check if user has admin role (optionally scoped)
 * Returns true if user has admin or super_admin role
 */
export async function isAdmin(
  clerkUserId: string,
  options?: {
    domain?: string | null;
    scope?: string | null;
  }
): Promise<boolean> {
  try {
    const [user] = await db
      .select({
        id: users.id,
        roleName: roles.name,
        primaryDomain: domains.name,
        primaryScope: scopes.name
      })
      .from(users)
      .leftJoin(roles, eq(users.role_id, roles.id))
      .leftJoin(domains, eq(users.primary_domain_id, domains.id))
      .leftJoin(scopes, eq(users.primary_scope_id, scopes.id))
      .where(eq(users.clerk_id, clerkUserId))
      .limit(1);

    if (!user || !user.roleName) {
      return false;
    }

    // Super admin has access to everything
    if (user.roleName === "super_admin") {
      return true;
    }

    // Must be at least admin
    if (user.roleName !== "admin") {
      return false;
    }

    // If no specific domain/scope requested, just return true (is an admin)
    if (options?.domain === undefined && options?.scope === undefined) {
      return true;
    }

    // Check primary assignment
    if (options?.domain !== undefined) {
      if (options.domain === null) {
        // Checking for "no domain" - usually implies global admin, but admins are always scoped or primary scoped?
        // If primary domain is null, then yes.
        if (user.primaryDomain === null) return true;
      } else {
        if (user.primaryDomain === options.domain) {
          if (options.scope === undefined) return true;
          if (options.scope === null && user.primaryScope === null) return true;
          if (options.scope !== null && user.primaryScope === options.scope) return true;
        }
      }
    }

    // Check secondary assignments
    if (options?.domain !== undefined) {
      if (options.domain === null) {
        // admin_assignments always have a domain_id (not null in schema), so this case is impossible for secondary assignments
        // unless we interpret "null domain" as something else. 
        // But let's assume if domain is null, we only check primary.
        return false;
      } else {
        // Join domains to check name
        // We'll do this in the query below
      }
    }

    const query = db
      .select()
      .from(admin_assignments)
      .innerJoin(domains, eq(admin_assignments.domain_id, domains.id))
      .leftJoin(scopes, eq(admin_assignments.scope_id, scopes.id))
      .where(eq(admin_assignments.user_id, user.id));

    const assignments = await query;

    for (const assignment of assignments) {
      if (options?.domain !== undefined && options.domain !== null) {
        if (assignment.domains.name !== options.domain) continue;
      }

      if (options?.scope !== undefined) {
        if (options.scope === null) {
          if (assignment.admin_assignments.scope_id !== null) continue;
        } else {
          if (assignment.scopes?.name !== options.scope) continue;
        }
      }

      return true;
    }

    return false;
  } catch (error) {
    console.error("[DB Helpers] Error checking admin status:", error);
    return false;
  }
}

/**
 * Check if user has a specific role with domain/scope
 * More flexible than isAdmin - checks any role with optional scoping
 */
export async function userHasScope(
  clerkUserId: string,
  roleName: UserRole,
  domain?: string | null,
  scope?: string | null
): Promise<boolean> {
  try {
    const { userHasRole } = await import("@/lib/auth/db-roles");
    return await userHasRole(clerkUserId, roleName, { domain, scope });
  } catch (error) {
    console.error("[DB Helpers] Error checking user scope:", error);
    return false;
  }
}

/**
 * Get active committee members for a committee
 * Returns users with their details
 */
export async function getActiveCommitteeMembers(committeeId: number): Promise<Array<{
  userId: string;
  clerkId: string;
  name: string | null;
  email: string | null;
  role: string | null; // Committee-specific role (chair, member, etc.)
}>> {
  try {
    const members = await db
      .select({
        userId: users.id,
        clerkId: users.clerk_id,
        name: sql<string>`concat(${users.first_name}, ' ', ${users.last_name})`,
        email: users.email,
        committeeRole: committee_members.role,
      })
      .from(committee_members)
      .innerJoin(users, eq(committee_members.user_id, users.id))
      .where(eq(committee_members.committee_id, committeeId));

    return members.map(m => ({
      userId: m.userId,
      clerkId: m.clerkId,
      name: m.name,
      email: m.email,
      role: m.committeeRole,
    }));
  } catch (error) {
    console.error("[DB Helpers] Error getting active committee members:", error);
    return [];
  }
}

/**
 * Get POC (Point of Contact) for a category
 * Returns user assigned as default_authority for the category
 */
export async function getPOCForCategory(categoryId: number): Promise<{
  userId: string;
  clerkId: string;
  name: string;
  email: string | null;
  slackUserId: string | null;
} | null> {
  try {
    // Check if default_authority column exists first
    const columnCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'categories'
        AND column_name = 'default_authority'
      ) as exists;
    `);
    type ColumnCheckResult = { exists?: boolean };
    const columnExists = (columnCheck[0] as ColumnCheckResult)?.exists === true;

    if (!columnExists) {
      return null;
    }

    // Use raw SQL to get default_authority
    const categoryResult = await db.execute(sql`
      SELECT default_authority 
      FROM categories 
      WHERE id = ${categoryId}
      LIMIT 1
    `);

    type CategoryResult = { default_authority?: string };
    if (!categoryResult.length || !(categoryResult[0] as CategoryResult)?.default_authority) {
      return null;
    }

    const defaultAuthority = (categoryResult[0] as CategoryResult).default_authority;
    
    if (!defaultAuthority) {
      return null;
    }

    const [poc] = await db
      .select({
        userId: users.id,
        firstName: users.first_name,
        lastName: users.last_name,
        email: users.email,
        slackUserId: users.slack_user_id,
        clerkId: users.clerk_id,
      })
      .from(users)
      .where(eq(users.id, defaultAuthority))
      .limit(1);

    if (!poc) {
      return null;
    }

    return {
      userId: poc.userId,
      clerkId: poc.clerkId,
      name: `${poc.firstName} ${poc.lastName}`.trim(),
      email: poc.email,
      slackUserId: poc.slackUserId,
    };
  } catch (error) {
    console.error("[DB Helpers] Error getting POC for category:", error);
    return null;
  }
}

/**
 * Get open tickets for an admin
 * Returns tickets assigned to admin that are not resolved/closed
 * Optionally filters by domain/scope if admin has scoped assignment
 */
export async function getOpenTicketsForAdmin(
  clerkUserId: string,
  options?: {
    domain?: string | null;
    scope?: string | null;
  }
 ): Promise<Array<{
   id: number;
   status: string;
   category: string | null;
   subcategory: string | null;
   description: string | null;
   created_at: Date | null;
   due_at: Date | null;
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

    // Build query conditions
    const conditions = [
      eq(tickets.assigned_to, user.id),
      sql`${ticket_statuses.value} != 'RESOLVED'`,
      sql`${ticket_statuses.value} != 'CLOSED'`,
    ];

    // Apply domain/scope filters if provided
    if (options?.domain) {
      // This requires joining categories
      conditions.push(eq(categories.name, options.domain));
      // Scope logic is tricky as location is loose text or scope name?
      // Assuming location matches scope name
      if (options?.scope) {
        conditions.push(eq(tickets.location, options.scope));
      }
    }

    const openTickets = await db
      .select({
        id: tickets.id,
        status: ticket_statuses.value,
        // priority: tickets.priority, // Removed
        category: categories.name,
        subcategory: sql<string>`''`, // Need join for subcategory name if needed
        description: tickets.description,
        created_at: tickets.created_at,
        due_at: tickets.resolution_due_at,
      })
      .from(tickets)
      .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
      .leftJoin(categories, eq(tickets.category_id, categories.id))
      .where(and(...conditions))
      .orderBy(tickets.created_at);

     return openTickets.map(t => ({
       ...t,
       status: t.status || "OPEN",
       category: t.category || null,
       subcategory: null // Placeholder
     }));
  } catch (error) {
    console.error("[DB Helpers] Error getting open tickets for admin:", error);
    return [];
  }
}

/**
 * Get tickets needing acknowledgement
 * Returns tickets assigned to admin that haven't been acknowledged yet
 */
export async function getTicketsNeedingAcknowledgement(
  clerkUserId: string
 ): Promise<Array<{
   id: number;
   status: string;
   category: string | null;
   created_at: Date | null;
   due_at: Date | null;
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

    const ticketsNeedingAck = await db
      .select({
        id: tickets.id,
        status: ticket_statuses.value,
        category: categories.name,
        created_at: tickets.created_at,
        due_at: tickets.resolution_due_at,
      })
      .from(tickets)
      .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
      .leftJoin(categories, eq(tickets.category_id, categories.id))
      .where(
        and(
          eq(tickets.assigned_to, user.id),
          eq(ticket_statuses.value, "OPEN"),
          isNull(tickets.acknowledged_at)
        )
      )
      .orderBy(tickets.created_at);

     return ticketsNeedingAck.map(t => ({
       ...t,
       status: t.status || "OPEN"
     }));
  } catch (error) {
    console.error("[DB Helpers] Error getting tickets needing acknowledgement:", error);
    return [];
  }
}

/**
 * Get tickets that are overdue (past due_at date)
 * Returns tickets that have breached their SLA
 */
export async function getTicketsOverdue( ): Promise<Array<{
   id: number;
   status: string;
   category: string | null;
   created_at: Date | null;
   due_at: Date | null;
   sla_breached_at: Date | null;
   assigned_to: string | null; // Changed from number to string (UUID)
 }>> {
  try {
    const now = new Date();

    const overdueTickets = await db
      .select({
        id: tickets.id,
        status: ticket_statuses.value,
        category: categories.name,
        created_at: tickets.created_at,
        due_at: tickets.resolution_due_at,
        sla_breached_at: tickets.sla_breached_at,
        assigned_to: tickets.assigned_to,
      })
      .from(tickets)
      .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
      .leftJoin(categories, eq(tickets.category_id, categories.id))
      .where(
        and(
          isNotNull(tickets.resolution_due_at),
          lt(tickets.resolution_due_at, now),
          sql`${ticket_statuses.value} != 'RESOLVED'`,
          sql`${ticket_statuses.value} != 'CLOSED'`,
          sql`${ticket_statuses.value} != 'AWAITING_STUDENT'` // Exclude tickets awaiting student response from overdue
        )
      )
      .orderBy(tickets.resolution_due_at);

     return overdueTickets.map(t => ({
       ...t,
       status: t.status || "OPEN"
     }));
  } catch (error) {
    console.error("[DB Helpers] Error getting overdue tickets:", error);
    return [];
  }
}
