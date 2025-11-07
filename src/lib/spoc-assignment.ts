/**
 * SPOC Assignment Utility
 * Handles automatic assignment of tickets to SPOCs based on category and location
 */

import { db, staff } from "@/db";
import { eq, and, or, isNull } from "drizzle-orm";

/**
 * Find the appropriate SPOC (Single Point of Contact) for a ticket
 * based on category and location
 */
export async function findSPOCForTicket(
  category: string,
  location: string | null
): Promise<string | null> {
  try {
    // Build query based on category and location
    let query = db.select().from(staff).where(eq(staff.domain, category));

    // If Hostel category and location is provided, match by scope
    if (category === "Hostel" && location) {
      query = db
        .select()
        .from(staff)
        .where(
          and(
            eq(staff.domain, "Hostel"),
            eq(staff.scope, location)
          )
        );
    }

    const staffMembers = await query;

    // Filter to only admins (not super_admins) and those with clerkUserId
    const availableSPOCs = staffMembers.filter(
      (s) => s.role === "admin" && s.clerkUserId
    );

    if (availableSPOCs.length === 0) {
      // Fallback: try to find any admin in the domain without scope requirement
      const fallback = await db
        .select()
        .from(staff)
        .where(
          and(
            eq(staff.domain, category),
            eq(staff.role, "admin"),
            or(eq(staff.scope, null), isNull(staff.scope))
          )
        );
      
      if (fallback.length > 0 && fallback[0].clerkUserId) {
        return fallback[0].clerkUserId;
      }
      
      return null;
    }

    // Simple round-robin: pick first available SPOC
    // TODO: Could implement load balancing based on ticket count
    return availableSPOCs[0].clerkUserId || null;
  } catch (error) {
    console.error("Error finding SPOC for ticket:", error);
    return null;
  }
}

