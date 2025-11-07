/**
 * Admin Assignment Utility
 * Handles determining which tickets an admin can see based on their domain/scope assignment
 */

import { db, staff } from "@/db";
import { eq, and } from "drizzle-orm";

export interface AdminAssignment {
  domain: string | null; // "Hostel" | "College" | null
  scope: string | null; // "Velankani" | "Neeladri" | null (for Hostel)
}

/**
 * Get admin's domain and scope assignment from staff table
 */
export async function getAdminAssignment(clerkUserId: string): Promise<AdminAssignment> {
  try {
    const staffMember = await db
      .select()
      .from(staff)
      .where(
        and(
          eq(staff.clerkUserId, clerkUserId),
          eq(staff.role, "admin")
        )
      )
      .limit(1);

    if (staffMember.length === 0) {
      // Admin not found in staff table, return null (will see all unassigned tickets)
      return { domain: null, scope: null };
    }

    return {
      domain: staffMember[0].domain || null,
      scope: staffMember[0].scope || null,
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
 */
export async function getAdminsForDomainScope(
  domain: string,
  scope: string | null = null
): Promise<string[]> {
  try {
    let query = db
      .select()
      .from(staff)
      .where(
        and(
          eq(staff.domain, domain),
          eq(staff.role, "admin")
        )
      );

    const staffMembers = await query;

    // Filter by scope if provided
    const filtered = scope
      ? staffMembers.filter((s) => s.scope === scope)
      : staffMembers.filter((s) => !s.scope || s.scope === null);

    return filtered
      .map((s) => s.clerkUserId)
      .filter((id): id is string => id !== null && id !== undefined);
  } catch (error) {
    console.error("Error fetching admins for domain/scope:", error);
    return [];
  }
}

