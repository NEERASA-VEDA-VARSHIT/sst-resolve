// lib/tickets/assignSpoc.ts
import { db, users, categories, subcategories } from "@/db";
import { eq } from "drizzle-orm";
import { getAdminsForDomainScope } from "@/lib/assignment/admin-assignment";

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
   
  _fieldSlugs?: string[]
): Promise<string | null> {
  try {
    // Debug: trace inputs
    console.log("[findSPOCForTicket] inputs:", {
      categoryName,
      location,
      categoryId,
      subcategoryId,
      _fieldSlugs,
    });

    // 1) Domain + scope based matching (Hostel / College)
    // ---------------------------------------------------
    // Derive domain from category name (we expect categories to be "Hostel" / "College")
    const normalizedCategory = (categoryName || "").toLowerCase();
    let domainName: string | null = null;
    if (normalizedCategory === "hostel" || normalizedCategory === "college") {
      domainName = normalizedCategory.charAt(0).toUpperCase() + normalizedCategory.slice(1);
    }

    if (domainName) {
      // Scope for Hostel: use location/hostel name if present; for College, scope is null
      const scopeName = domainName.toLowerCase() === "hostel" && location ? location : null;
      console.log("[findSPOCForTicket] derived domain/scope:", {
        domainName,
        scopeName,
      });
      const candidateAdmins = await getAdminsForDomainScope(domainName, scopeName);
      console.log("[findSPOCForTicket] candidateAdmins from domain/scope:", {
        domainName,
        scopeName,
        count: candidateAdmins.length,
        candidateAdmins,
      });

      if (candidateAdmins.length === 1) {
        // getAdminsForDomainScope returns clerk external_ids
        console.log("[findSPOCForTicket] selected admin from domain/scope:", {
          selected: candidateAdmins[0],
        });
        return candidateAdmins[0];
      }
    }

    // 2) Subcategory direct assignment (if present)
    // --------------------------------------------
    if (subcategoryId) {
      const [subcategory] = await db
        .select({
          external_id: users.external_id,
        })
        .from(subcategories)
        .leftJoin(users, eq(subcategories.assigned_admin_id, users.id))
        .where(eq(subcategories.id, subcategoryId))
        .limit(1);

      console.log("[findSPOCForTicket] subcategory lookup result:", {
        subcategoryId,
        external_id: subcategory?.external_id,
      });

      if (subcategory?.external_id) {
        console.log("[findSPOCForTicket] selected admin from subcategory:", {
          selected: subcategory.external_id,
        });
        return subcategory.external_id;
      }
    }

    // 3) Category default admin
    // -------------------------
    if (categoryId) {
      const [category] = await db
        .select({
          external_id: users.external_id,
        })
        .from(categories)
        .leftJoin(users, eq(categories.default_admin_id, users.id))
        .where(eq(categories.id, categoryId))
        .limit(1);

      console.log("[findSPOCForTicket] category default admin lookup:", {
        categoryId,
        external_id: category?.external_id,
      });

      if (category?.external_id) {
        console.log("[findSPOCForTicket] selected admin from category default:", {
          selected: category.external_id,
        });
        return category.external_id;
      }
    }

    // 4) No match found
    console.log("[findSPOCForTicket] no admin match found, leaving unassigned");
    return null;
  } catch (err) {
    console.error("findSPOCForTicket failed:", err);
    return null;
  }
}
