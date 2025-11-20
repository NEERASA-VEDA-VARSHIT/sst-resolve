// lib/tickets/assignSpoc.ts
import { db, staff, users, categories, subcategories } from "@/db";
import { eq } from "drizzle-orm";

/**
 * findSPOCForTicket - baseline SPOC resolution.
 *
 * Inputs:
 *  - categoryName (string)
 *  - location (string | null)
 *  - categoryId (number)
 *  - subcategoryId (number | null)
 *  - fieldSlugs?: string[] -- helpful for field-level assignment
 *
 * Returns clerkId (string) of assigned admin/staff OR null if none found.
 *
 * Approach:
 *  - Baseline: consult staff_assignments table (category_id, subcategory_id, location pattern).
 *  - Optimized (future): weighted matching, geo-hierarchy, round-robin, on-call schedules.
 *
 * NOTE: change `staff_assignments` to fit your schema (I guessed a table to store SPOC mapping).
 */

export async function findSPOCForTicket(
  categoryName: string,
  location: string | null,
  categoryId: number,
  subcategoryId?: number | null,
  fieldSlugs?: string[]
): Promise<string | null> {
  try {
    // Try subcategory assignment first (if subcategoryId is provided)
    if (subcategoryId) {
      const [subcategory] = await db
        .select({ 
          clerk_id: users.clerk_id 
        })
        .from(subcategories)
        .leftJoin(staff, eq(subcategories.assigned_admin_id, staff.id))
        .leftJoin(users, eq(staff.user_id, users.id))
        .where(eq(subcategories.id, subcategoryId))
        .limit(1);
      
      if (subcategory?.clerk_id) return subcategory.clerk_id;
    }

    // Fallback to category default authority
    if (categoryId) {
      const [category] = await db
        .select({ 
          clerk_id: users.clerk_id 
        })
        .from(categories)
        .leftJoin(staff, eq(categories.default_authority, staff.id))
        .leftJoin(users, eq(staff.user_id, users.id))
        .where(eq(categories.id, categoryId))
        .limit(1);
      
      if (category?.clerk_id) return category.clerk_id;
    }

    // Last resort: pick any staff as fallback (first available)
    const [fallback] = await db
      .select({ clerk_id: users.clerk_id })
      .from(staff)
      .leftJoin(users, eq(staff.user_id, users.id))
      .limit(1);
    return fallback?.clerk_id || null;
  } catch (err) {
    console.error("findSPOCForTicket failed:", err);
    return null;
  }
}
