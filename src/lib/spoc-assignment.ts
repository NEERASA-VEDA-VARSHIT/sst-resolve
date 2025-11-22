/**
 * SPOC Assignment Utility
 * Handles automatic assignment of tickets to SPOCs based on category and location
 * Follows hierarchy: field > subcategory > category > escalation rules
 */

import { db, users, roles, categories, domains, scopes } from "@/db";
import { eq, and, sql } from "drizzle-orm";

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
  fieldSlugs?: string[] // Field slugs from ticket metadata to check for field-level assignment
): Promise<string | null> {
  try {
    // Hierarchy: field > subcategory > category > escalation rules

    // 1. Check field-level assignment (if field slugs provided)
    if (fieldSlugs && fieldSlugs.length > 0 && subcategoryId) {
      try {
        // Check if column exists in database first
        const columnCheck = await db.execute(sql`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'category_fields'
            AND column_name = 'assigned_admin_id'
          ) as exists;
        `);
        type ColumnCheckResult = { exists?: boolean };
        const columnExists = (columnCheck[0] as ColumnCheckResult)?.exists === true;

        if (columnExists) {
          // Use raw SQL to avoid Drizzle processing undefined column references
          // Format array properly for PostgreSQL ANY operator
          const fieldAssignments = await db.execute(sql`
            SELECT assigned_admin_id 
            FROM category_fields 
            WHERE subcategory_id = ${subcategoryId}
              AND slug = ANY(${sql.raw(`ARRAY[${fieldSlugs.map(slug => `'${slug.replace(/'/g, "''")}'`).join(',')}]`)})
              AND active = true
            LIMIT 1
          `);

          type FieldAssignmentResult = { assigned_admin_id?: string };
          if (fieldAssignments.length > 0 && (fieldAssignments[0] as FieldAssignmentResult)?.assigned_admin_id) {
            const adminId = (fieldAssignments[0] as FieldAssignmentResult).assigned_admin_id;
            if (!adminId || typeof adminId !== 'string') return null;
            const adminUser = await db
              .select({
                clerk_id: users.clerk_id,
              })
              .from(users)
              .where(eq(users.id, adminId))
              .limit(1);

            if (adminUser.length > 0 && adminUser[0].clerk_id) {
              return adminUser[0].clerk_id;
            }
          }
        }
      } catch (error) {
        // Column might not exist yet if migration hasn't been run
        console.warn("Field-level assignment check failed (column may not exist):", error);
      }
    }

    // 2. Check subcategory-level assignment
    if (subcategoryId) {
      try {
        // Check if column exists in database first
        const columnCheck = await db.execute(sql`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'subcategories'
            AND column_name = 'assigned_admin_id'
          ) as exists;
        `);
        type ColumnCheckResult = { exists?: boolean };
        const columnExists = (columnCheck[0] as ColumnCheckResult)?.exists === true;

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
            const adminUser = await db
              .select({
                clerk_id: users.clerk_id,
              })
              .from(users)
              .where(eq(users.id, adminId))
              .limit(1);

            if (adminUser.length > 0 && adminUser[0].clerk_id) {
              return adminUser[0].clerk_id;
            }
          }
        }
      } catch (error) {
        // Column might not exist yet if migration hasn't been run
        console.warn("Subcategory-level assignment check failed (column may not exist):", error);
      }
    }

    // 3. Check category-level assignment (Multiple Admins support) - Priority #4
    if (categoryId) {
      try {
        // Check if table exists first (safety check)
        const tableCheck = await db.execute(sql`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'category_assignments'
          ) as exists;
        `);
        type TableCheckResult = { exists?: boolean };
        const tableExists = (tableCheck[0] as TableCheckResult)?.exists === true;

        if (tableExists) {
          // Query category_assignments table
          // Order by: is_primary DESC (true first), priority DESC (higher first), created_at ASC (oldest first)
          const assignments = await db.execute(sql`
            SELECT user_id 
            FROM category_assignments 
            WHERE category_id = ${categoryId}
            ORDER BY is_primary DESC, priority DESC, created_at ASC
            LIMIT 1
          `);

          type AssignmentResult = { user_id?: string };
          if (assignments.length > 0 && (assignments[0] as AssignmentResult)?.user_id) {
            const adminId = (assignments[0] as AssignmentResult).user_id;
            if (!adminId || typeof adminId !== 'string') return null;
            const adminUser = await db
              .select({
                clerk_id: users.clerk_id,
              })
              .from(users)
              .where(eq(users.id, adminId))
              .limit(1);

            if (adminUser.length > 0 && adminUser[0].clerk_id) {
              return adminUser[0].clerk_id;
            }
          }
        }
      } catch (error) {
        console.warn("Category-level assignment check failed:", error);
      }
    }

    // 4. Check category default_admin_id (Priority #5)
    if (categoryId) {
      try {
        const [category] = await db
          .select({
            default_admin_id: categories.default_admin_id,
          })
          .from(categories)
          .where(eq(categories.id, categoryId))
          .limit(1);

        if (category?.default_admin_id) {
          const adminUser = await db
            .select({
              clerk_id: users.clerk_id,
            })
            .from(users)
            .where(eq(users.id, category.default_admin_id))
            .limit(1);

          if (adminUser.length > 0 && adminUser[0].clerk_id) {
            return adminUser[0].clerk_id;
          }
        }
      } catch (error) {
        console.warn("Category default admin check failed:", error);
      }
    }

    // 5. Fallback to domain/scope matching (Priority #6)
    // We need to find an admin whose primary_domain matches the category
    // Note: This assumes 'category' string matches a 'domain' name.

    // First, try to find the domain ID for the category name
    const [domain] = await db
      .select({ id: domains.id })
      .from(domains)
      .where(eq(domains.name, category))
      .limit(1);

    if (domain) {
      let query = db
        .select({
          clerk_id: users.clerk_id,
        })
        .from(users)
        .leftJoin(roles, eq(users.role_id, roles.id))
        .where(
          and(
            eq(users.primary_domain_id, domain.id),
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
              clerk_id: users.clerk_id,
            })
            .from(users)
            .leftJoin(roles, eq(users.role_id, roles.id))
            .where(
              and(
                eq(users.primary_domain_id, domain.id),
                eq(users.primary_scope_id, scope.id),
                eq(roles.name, "admin")
              )
            );
        }
      }

      const staffMembers = await query;

      if (staffMembers.length > 0 && staffMembers[0].clerk_id) {
        return staffMembers[0].clerk_id;
      }
    }

    return null;
  } catch (error) {
    console.error("Error finding SPOC for ticket:", error);
    return null;
  }
}
