/**
 * SPOC Assignment Utility
 * Handles automatic assignment of tickets to SPOCs based on category and location
 * Follows hierarchy: field > domain/scope > subcategory > category > escalation rules
 */

import { db, users, roles, categories, domains, scopes, admin_profiles } from "@/db";
import { eq, and, sql } from "drizzle-orm";
import { getAdminsForDomainScope } from "@/lib/assignment/admin-assignment";

// Cache column/table existence checks (these don't change during runtime)
const COLUMN_EXISTS_CACHE = new Map<string, boolean>();
const TABLE_EXISTS_CACHE = new Map<string, boolean>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cacheTimestamps = new Map<string, number>();

async function checkColumnExists(tableName: string, columnName: string): Promise<boolean> {
  const cacheKey = `${tableName}.${columnName}`;
  const now = Date.now();
  
  // Check cache
  if (COLUMN_EXISTS_CACHE.has(cacheKey)) {
    const timestamp = cacheTimestamps.get(cacheKey) || 0;
    if (now - timestamp < CACHE_TTL) {
      return COLUMN_EXISTS_CACHE.get(cacheKey)!;
    }
  }
  
  // Query database
  try {
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = ${tableName}
        AND column_name = ${columnName}
      ) as exists;
    `);
    type ColumnCheckResult = { exists?: boolean };
    const exists = (result[0] as ColumnCheckResult)?.exists === true;
    
    // Cache result
    COLUMN_EXISTS_CACHE.set(cacheKey, exists);
    cacheTimestamps.set(cacheKey, now);
    return exists;
  } catch (error) {
    console.warn(`[spoc-assignment] Column existence check failed for ${cacheKey}:`, error);
    return false;
  }
}

async function checkTableExists(tableName: string): Promise<boolean> {
  const cacheKey = tableName;
  const now = Date.now();
  
  // Check cache
  if (TABLE_EXISTS_CACHE.has(cacheKey)) {
    const timestamp = cacheTimestamps.get(cacheKey) || 0;
    if (now - timestamp < CACHE_TTL) {
      return TABLE_EXISTS_CACHE.get(cacheKey)!;
    }
  }
  
  // Query database
  try {
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = ${tableName}
      ) as exists;
    `);
    type TableCheckResult = { exists?: boolean };
    const exists = (result[0] as TableCheckResult)?.exists === true;
    
    // Cache result
    TABLE_EXISTS_CACHE.set(cacheKey, exists);
    cacheTimestamps.set(cacheKey, now);
    return exists;
  } catch (error) {
    console.warn(`[spoc-assignment] Table existence check failed for ${cacheKey}:`, error);
    return false;
  }
}

/**
 * Find the appropriate SPOC (Single Point of Contact) for a ticket
 * based on category, subcategory, fields, and location
 * Follows hierarchy: field > subcategory > category > escalation rules
 */
export async function findSPOCForTicket(
  category: string,
  location: string | null,
  categoryId?: number | null,
  subcategoryId?: number | null,
  fieldSlugs?: string[], // Field slugs from ticket metadata to check for field-level assignment
  categoryDefaultAdminId?: string | null // Optional: pass to avoid redundant query
): Promise<string | null> {
  try {
    // Debug: trace inputs for SPOC assignment
    console.log("[spoc-assignment] findSPOCForTicket inputs:", {
      category,
      location,
      categoryId,
      subcategoryId,
      fieldSlugs,
    });

    // Hierarchy: field > domain/scope > subcategory > category > escalation rules

    // 1. Check field-level assignment (if field slugs provided)
    if (fieldSlugs && fieldSlugs.length > 0 && subcategoryId) {
      try {
        // Check if column exists in database first (cached)
        const columnExists = await checkColumnExists('category_fields', 'assigned_admin_id');

        if (columnExists) {
          // Use raw SQL to avoid Drizzle processing undefined column references
          // Format array properly for PostgreSQL ANY operator
          const fieldAssignments = await db.execute(sql`
            SELECT assigned_admin_id 
            FROM category_fields 
            WHERE subcategory_id = ${subcategoryId}
              AND slug = ANY(${sql.raw(`ARRAY[${fieldSlugs.map(slug => `'${slug.replace(/'/g, "''")}'`).join(',')}]`)})
              AND is_active = true
            LIMIT 1
          `);

          type FieldAssignmentResult = { assigned_admin_id?: string };
          if (fieldAssignments.length > 0 && (fieldAssignments[0] as FieldAssignmentResult)?.assigned_admin_id) {
            const adminId = (fieldAssignments[0] as FieldAssignmentResult).assigned_admin_id;
            if (!adminId || typeof adminId !== 'string') return null;
            // Optimize: Get external_id directly in a single query
            const [adminUser] = await db
              .select({
                external_id: users.external_id,
              })
              .from(users)
              .where(eq(users.id, adminId))
              .limit(1);

            if (adminUser?.external_id) {
              return adminUser.external_id;
            }
          }
        }
      } catch (error) {
        // Column might not exist yet if migration hasn't been run
        const errorMessage = error instanceof Error 
          ? error.message 
          : typeof error === 'string' 
            ? error 
            : 'Unknown error';
        console.warn(`Field-level assignment check failed (column may not exist):`, errorMessage);
      }
    }

    // 2. Domain + scope based matching (Hostel / College)
    //    This runs BEFORE subcategory/category assignment to honor domain/scope priority.
    // ------------------------------------------------------------------------
    const normalizedCategory = (category || "").toLowerCase();
    let domainName: string | null = null;
    if (normalizedCategory === "hostel" || normalizedCategory === "college") {
      domainName = normalizedCategory.charAt(0).toUpperCase() + normalizedCategory.slice(1);
    }

    if (domainName) {
      // Scope for Hostel: use location (hostel name) if present; for College, scope is null
      const scopeName = domainName.toLowerCase() === "hostel" && location ? location : null;
      console.log("[spoc-assignment] domain/scope stage:", {
        domainName,
        scopeName,
      });

      const candidateAdmins = await getAdminsForDomainScope(domainName, scopeName);
      console.log("[spoc-assignment] candidateAdmins from domain/scope:", {
        domainName,
        scopeName,
        count: candidateAdmins.length,
        candidateAdmins,
      });

      if (candidateAdmins.length === 1) {
        console.log("[spoc-assignment] selected admin from domain/scope:", {
          selected: candidateAdmins[0],
        });
        return candidateAdmins[0];
      }
    }

    // 3. Check subcategory-level assignment
    if (subcategoryId) {
      try {
        // Check if column exists in database first (cached)
        const columnExists = await checkColumnExists('subcategories', 'assigned_admin_id');

        if (columnExists) {
          // Use raw SQL to avoid Drizzle processing undefined column references
          const subcategoryResult = await db.execute(sql`
            SELECT assigned_admin_id 
            FROM subcategories 
            WHERE id = ${subcategoryId}
            LIMIT 1
          `);

          type SubcategoryResult = { assigned_admin_id?: string };
          if (subcategoryResult.length > 0 && (subcategoryResult[0] as SubcategoryResult)?.assigned_admin_id) {
            const adminId = (subcategoryResult[0] as SubcategoryResult).assigned_admin_id;
            if (!adminId || typeof adminId !== 'string') return null;
            // Optimize: Get external_id directly in a single query
            const [adminUser] = await db
              .select({
                external_id: users.external_id,
              })
              .from(users)
              .where(eq(users.id, adminId))
              .limit(1);

            if (adminUser?.external_id) {
              return adminUser.external_id;
            }
          }
        }
      } catch (error) {
        // Column might not exist yet if migration hasn't been run
        const errorMessage = error instanceof Error 
          ? error.message 
          : typeof error === 'string' 
            ? error 
            : 'Unknown error';
        console.warn(`Subcategory-level assignment check failed (column may not exist):`, errorMessage);
      }
    }

    // 4. Check category-level assignment (Multiple Admins support)
    if (categoryId) {
      try {
        // Check if table exists first (cached)
        const tableExists = await checkTableExists('category_assignments');

        if (tableExists) {
          // Query category_assignments table
          // Order by: created_at ASC (oldest first) to get the first assignment
          const assignments = await db.execute(sql`
            SELECT user_id 
            FROM category_assignments 
            WHERE category_id = ${categoryId}
            ORDER BY created_at ASC
            LIMIT 1
          `);

          type AssignmentResult = { user_id?: string };
          if (assignments.length > 0 && (assignments[0] as AssignmentResult)?.user_id) {
            const adminId = (assignments[0] as AssignmentResult).user_id;
            if (!adminId || typeof adminId !== 'string') return null;
            // Optimize: Get external_id directly in a single query
            const [adminUser] = await db
              .select({
                external_id: users.external_id,
              })
              .from(users)
              .where(eq(users.id, adminId))
              .limit(1);

            if (adminUser?.external_id) {
              return adminUser.external_id;
            }
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error 
          ? error.message 
          : typeof error === 'string' 
            ? error 
            : 'Unknown error';
        console.warn(`Category-level assignment check failed:`, errorMessage);
      }
    }

    // 5. Check category default_admin_id
    // Optimize: Use passed default_admin_id if available to avoid redundant query
    if (categoryDefaultAdminId) {
      try {
        // Optimize: Get external_id directly in a single query
        const [adminUser] = await db
          .select({
            external_id: users.external_id,
          })
          .from(users)
          .where(eq(users.id, categoryDefaultAdminId))
          .limit(1);

        if (adminUser?.external_id) {
          return adminUser.external_id;
        }
      } catch (error) {
        const errorMessage = error instanceof Error 
          ? error.message 
          : typeof error === 'string' 
            ? error 
            : 'Unknown error';
        console.warn(`Category default admin check failed:`, errorMessage);
      }
    } else if (categoryId) {
      // Fallback: query if not passed (for backward compatibility)
      try {
        const [category] = await db
          .select({
            default_admin_id: categories.default_admin_id,
          })
          .from(categories)
          .where(eq(categories.id, categoryId))
          .limit(1);

        if (category && category.default_admin_id) {
          // Optimize: Get external_id directly in a single query
          const [adminUser] = await db
            .select({
              external_id: users.external_id,
            })
            .from(users)
            .where(eq(users.id, category.default_admin_id))
            .limit(1);

          if (adminUser?.external_id) {
            return adminUser.external_id;
          }
        }
      } catch (error) {
        // Safe error logging - avoid Object.entries on error objects
        const errorMessage = error instanceof Error 
          ? error.message 
          : typeof error === 'string' 
            ? error 
            : 'Unknown error';
        console.warn(`Category default admin check failed for categoryId ${categoryId}:`, errorMessage);
      }
    }

    // 6. Legacy fallback to domain/scope matching via admin_profiles only
    //    (kept for backward compatibility; main domain/scope logic above)

    // First, try to find the domain ID for the category name
    const [domain] = await db
      .select({ id: domains.id })
      .from(domains)
      .where(eq(domains.name, category))
      .limit(1);

    if (domain) {
      let query = db
        .select({
          external_id: users.external_id,
        })
        .from(users)
        .leftJoin(roles, eq(users.role_id, roles.id))
        .leftJoin(admin_profiles, eq(admin_profiles.user_id, users.id))
        .where(
          and(
            eq(admin_profiles.primary_domain_id, domain.id),
            eq(roles.name, "admin")
          )
        );

      // If Hostel category and location is provided, match by scope
      if (category === "Hostel" && location) {
        const [scope] = await db
          .select({ id: scopes.id })
          .from(scopes)
          .where(eq(scopes.name, location))
          .limit(1);

        if (scope) {
          query = db
            .select({
              external_id: users.external_id,
            })
            .from(users)
            .leftJoin(roles, eq(users.role_id, roles.id))
            .leftJoin(admin_profiles, eq(admin_profiles.user_id, users.id))
            .where(
              and(
                eq(admin_profiles.primary_domain_id, domain.id),
                eq(admin_profiles.primary_scope_id, scope.id),
                eq(roles.name, "admin")
              )
            );
        }
      }

      const staffMembers = await query;

      if (staffMembers.length > 0 && staffMembers[0].external_id) {
        return staffMembers[0].external_id;
      }
    }

    return null;
  } catch (error) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : typeof error === 'string' 
        ? error 
        : 'Unknown error';
    console.error("Error finding SPOC for ticket:", errorMessage);
    if (error instanceof Error && error.stack) {
      console.error("Stack trace:", error.stack);
    }
    return null;
  }
}
