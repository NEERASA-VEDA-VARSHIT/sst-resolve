/**
 * Database Helper Functions
 * Optimized queries for common operations
 */

import { db, users, roles, user_roles, staff, tickets, committee_members, committees, categories } from "@/db";
import { eq, and, or, isNull, isNotNull, lt, gte, sql, inArray } from "drizzle-orm";
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
      .innerJoin(user_roles, eq(users.id, user_roles.user_id))
      .innerJoin(roles, eq(user_roles.role_id, roles.id))
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
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_id, clerkUserId))
      .limit(1);

    if (!user) {
      return false;
    }

    // Get admin or super_admin roles
    const conditions = [
      eq(user_roles.user_id, user.id),
      or(
        eq(roles.name, "admin"),
        eq(roles.name),
        eq(roles.name, "super_admin")
      ),
    ];

    if (options?.domain !== undefined) {
      if (options.domain === null) {
        conditions.push(isNull(user_roles.domain));
      } else {
        conditions.push(eq(user_roles.domain, options.domain));
      }
    }

    if (options?.scope !== undefined) {
      if (options.scope === null) {
        conditions.push(isNull(user_roles.scope));
      } else {
        conditions.push(eq(user_roles.scope, options.scope));
      }
    }

    const adminRoles = await db
      .select()
      .from(user_roles)
      .innerJoin(roles, eq(user_roles.role_id, roles.id))
      .where(and(...conditions))
      .limit(1);

    return adminRoles.length > 0;
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
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_id, clerkUserId))
      .limit(1);

    if (!user) {
      return false;
    }

    const roleId = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, roleName))
      .limit(1);

    if (roleId.length === 0) {
      return false;
    }

    const conditions = [
      eq(user_roles.user_id, user.id),
      eq(user_roles.role_id, roleId[0].id),
    ];

    if (domain !== undefined) {
      if (domain === null) {
        conditions.push(isNull(user_roles.domain));
      } else {
        conditions.push(eq(user_roles.domain, domain));
      }
    }

    if (scope !== undefined) {
      if (scope === null) {
        conditions.push(isNull(user_roles.scope));
      } else {
        conditions.push(eq(user_roles.scope, scope));
      }
    }

    const userRole = await db
      .select()
      .from(user_roles)
      .where(and(...conditions))
      .limit(1);

    return userRole.length > 0;
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
        name: users.name,
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
 * Returns staff member assigned as default_authority for the category
 */
export async function getPOCForCategory(categoryId: number): Promise<{
  staffId: number;
  userId: string;
  clerkId: string;
  name: string;
  email: string | null;
  slackUserId: string | null;
} | null> {
  try {
    // Check if default_authority column exists first, then use raw SQL to avoid Drizzle issues
    const columnCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'categories'
        AND column_name = 'default_authority'
      ) as exists;
    `);
    const columnExists = (columnCheck[0] as any)?.exists === true;
    
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

    if (!categoryResult.length || !(categoryResult[0] as any)?.default_authority) {
      return null;
    }

    const defaultAuthority = (categoryResult[0] as any).default_authority;

    const [poc] = await db
      .select({
        id: staff.id,
        userId: staff.user_id,
        fullName: staff.full_name,
        email: staff.email,
        slackUserId: staff.slack_user_id,
        clerkId: users.clerk_id,
      })
      .from(staff)
      .innerJoin(users, eq(staff.user_id, users.id))
      .where(eq(staff.id, defaultAuthority))
      .limit(1);

    if (!poc) {
      return null;
    }

    return {
      staffId: poc.id,
      userId: poc.userId,
      clerkId: poc.clerkId,
      name: poc.fullName,
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
  priority: string;
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

    // Get staff record for this admin
    const [staffMember] = await db
      .select({ id: staff.id, domain: staff.domain, scope: staff.scope })
      .from(staff)
      .where(eq(staff.user_id, user.id))
      .limit(1);

    if (!staffMember) {
      return [];
    }

    // Build query conditions
    const conditions = [
      eq(tickets.assigned_to, staffMember.id),
      sql`${tickets.status} != 'RESOLVED'`,
      sql`${tickets.status} != 'CLOSED'`,
    ];

    // Apply domain/scope filters if provided
    if (options?.domain) {
      conditions.push(eq(tickets.category, options.domain));
      if (options?.scope) {
        conditions.push(eq(tickets.location, options.scope));
      }
    }

    const openTickets = await db
      .select({
        id: tickets.id,
        status: tickets.status,
        priority: tickets.priority,
        category: tickets.category,
        subcategory: tickets.subcategory,
        description: tickets.description,
        created_at: tickets.created_at,
        due_at: tickets.due_at,
      })
      .from(tickets)
      .where(and(...conditions))
      .orderBy(tickets.created_at);

    return openTickets;
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
  priority: string;
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

    // Get staff record for this admin
    const [staffMember] = await db
      .select({ id: staff.id })
      .from(staff)
      .where(eq(staff.user_id, user.id))
      .limit(1);

    if (!staffMember) {
      return [];
    }

    const ticketsNeedingAck = await db
      .select({
        id: tickets.id,
        status: tickets.status,
        priority: tickets.priority,
        category: tickets.category,
        created_at: tickets.created_at,
        due_at: tickets.due_at,
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.assigned_to, staffMember.id),
          eq(tickets.status, "OPEN"),
          isNull(tickets.acknowledged_at)
        )
      )
      .orderBy(tickets.created_at);

    return ticketsNeedingAck;
  } catch (error) {
    console.error("[DB Helpers] Error getting tickets needing acknowledgement:", error);
    return [];
  }
}

/**
 * Get tickets that are overdue (past due_at date)
 * Returns tickets that have breached their SLA
 */
export async function getTicketsOverdue(): Promise<Array<{
  id: number;
  status: string;
  priority: string;
  category: string | null;
  created_at: Date | null;
  due_at: Date | null;
  sla_breached_at: Date | null;
  assigned_to: number | null;
}>> {
  try {
    const now = new Date();

    const overdueTickets = await db
      .select({
        id: tickets.id,
        status: tickets.status,
        priority: tickets.priority,
        category: tickets.category,
        created_at: tickets.created_at,
        due_at: tickets.due_at,
        sla_breached_at: tickets.sla_breached_at,
        assigned_to: tickets.assigned_to,
      })
      .from(tickets)
      .where(
        and(
          isNotNull(tickets.due_at),
          lt(tickets.due_at, now),
          sql`${tickets.status} != 'RESOLVED'`,
          sql`${tickets.status} != 'CLOSED'`
        )
      )
      .orderBy(tickets.due_at);

    return overdueTickets;
  } catch (error) {
    console.error("[DB Helpers] Error getting overdue tickets:", error);
    return [];
  }
}

