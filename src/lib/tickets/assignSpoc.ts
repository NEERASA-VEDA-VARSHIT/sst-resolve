// lib/tickets/assignSpoc.ts
import { db, users, categories, subcategories } from "@/db";
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
 *  - Baseline: consult assignments in subcategories/categories tables.
 *  - Optimized (future): weighted matching, geo-hierarchy, round-robin, on-call schedules.
 */

export async function findSPOCForTicket(
  categoryName: string,
  location: string | null,
  categoryId: number,
  subcategoryId?: number | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _fieldSlugs?: string[]
): Promise<string | null> {
  try {
    // Try subcategory assignment first (if subcategoryId is provided)
    if (subcategoryId) {
      const [subcategory] = await db
        .select({
          clerk_id: users.clerk_id
        })
        .from(subcategories)
        .leftJoin(users, eq(subcategories.assigned_admin_id, users.id))
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
        .leftJoin(users, eq(categories.default_admin_id, users.id))
        .where(eq(categories.id, categoryId))
        .limit(1);

      if (category?.clerk_id) return category.clerk_id;
    }

    return null;
  } catch (err) {
    console.error("findSPOCForTicket failed:", err);
    return null;
  }
}
