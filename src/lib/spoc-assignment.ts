/**
 * SPOC Assignment Utility
 * Handles automatic assignment of tickets to SPOCs based on category and location
 * Follows hierarchy: field > subcategory > category > escalation rules
 */

import { db, staff, users, roles, user_roles, categories, subcategories, category_fields } from "@/db";
import { eq, and, or, isNull, inArray, sql } from "drizzle-orm";

/**
 * Find the appropriate SPOC (Single Point of Contact) for a ticket
 * based on category, subcategory, fields, and location
 * Follows hierarchy: field > subcategory > category > escalation rules
 * Role is checked via user_roles table (multi-role support)
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
        const columnExists = (columnCheck[0] as any)?.exists === true;

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

          if (fieldAssignments.length > 0 && (fieldAssignments[0] as any)?.assigned_admin_id) {
            const adminId = (fieldAssignments[0] as any).assigned_admin_id;
            const adminStaff = await db
              .select({
                clerk_id: users.clerk_id,
              })
              .from(staff)
              .innerJoin(users, eq(staff.user_id, users.id))
              .where(eq(staff.id, adminId))
              .limit(1);

            if (adminStaff.length > 0 && adminStaff[0].clerk_id) {
              return adminStaff[0].clerk_id;
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
        const columnExists = (columnCheck[0] as any)?.exists === true;

        if (columnExists) {
          // Use raw SQL to avoid Drizzle processing undefined column references
          const subcategoryResult = await db.execute(sql`
            SELECT assigned_admin_id 
            FROM subcategories 
            WHERE id = ${subcategoryId}
            LIMIT 1
          `);

          if (subcategoryResult.length > 0 && (subcategoryResult[0] as any)?.assigned_admin_id) {
            const adminId = (subcategoryResult[0] as any).assigned_admin_id;
            const adminStaff = await db
              .select({
                clerk_id: users.clerk_id,
              })
              .from(staff)
              .innerJoin(users, eq(staff.user_id, users.id))
              .where(eq(staff.id, adminId))
              .limit(1);

            if (adminStaff.length > 0 && adminStaff[0].clerk_id) {
              return adminStaff[0].clerk_id;
            }
          }
        }
      } catch (error) {
        // Column might not exist yet if migration hasn't been run
        console.warn("Subcategory-level assignment check failed (column may not exist):", error);
      }
    }

    // 3. Check category-level assignment (Multiple Admins support)
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
        const tableExists = (tableCheck[0] as any)?.exists === true;

        if (tableExists) {
          // Query category_assignments table
          // Order by: is_primary DESC (true first), priority DESC (higher first), created_at ASC (oldest first)
          const assignments = await db.execute(sql`
            SELECT staff_id 
            FROM category_assignments 
            WHERE category_id = ${categoryId}
            ORDER BY is_primary DESC, priority DESC, created_at ASC
            LIMIT 1
          `);

          if (assignments.length > 0 && (assignments[0] as any)?.staff_id) {
            const adminId = (assignments[0] as any).staff_id;
            const adminStaff = await db
              .select({
                clerk_id: users.clerk_id,
              })
              .from(staff)
              .innerJoin(users, eq(staff.user_id, users.id))
              .where(eq(staff.id, adminId))
              .limit(1);

            if (adminStaff.length > 0 && adminStaff[0].clerk_id) {
              return adminStaff[0].clerk_id;
            }
          }
        } else {
          // Fallback to legacy default_authority if table doesn't exist yet
          console.warn("category_assignments table not found, falling back to default_authority");
          const categoryResult = await db.execute(sql`
            SELECT default_authority 
            FROM categories 
            WHERE id = ${categoryId}
            LIMIT 1
          `);

          if (categoryResult.length > 0 && (categoryResult[0] as any)?.default_authority) {
            const adminId = (categoryResult[0] as any).default_authority;
            const adminStaff = await db
              .select({
                clerk_id: users.clerk_id,
              })
              .from(staff)
              .innerJoin(users, eq(staff.user_id, users.id))
              .where(eq(staff.id, adminId))
              .limit(1);

            if (adminStaff.length > 0 && adminStaff[0].clerk_id) {
              return adminStaff[0].clerk_id;
            }
          }
        }
      } catch (error) {
        console.warn("Category-level assignment check failed:", error);
      }
    }

    // 4. Fallback to domain/scope matching (existing logic)
    // Build query based on category and location, joining with users and user_roles
    let query = db
      .select({
        clerk_id: users.clerk_id,
        scope: staff.scope,
      })
      .from(staff)
      .innerJoin(users, eq(staff.user_id, users.id))
      .innerJoin(user_roles, eq(users.id, user_roles.user_id))
      .innerJoin(roles, eq(user_roles.role_id, roles.id))
      .where(
        and(
          eq(staff.domain, category),
          eq(roles.name, "admin") // Only admins, not super_admins
        )
      );

    // If Hostel category and location is provided, match by scope
    if (category === "Hostel" && location) {
      query = db
        .select({
          clerk_id: users.clerk_id,
          scope: staff.scope,
        })
        .from(staff)
        .innerJoin(users, eq(staff.user_id, users.id))
        .innerJoin(user_roles, eq(users.id, user_roles.user_id))
        .innerJoin(roles, eq(user_roles.role_id, roles.id))
        .where(
          and(
            eq(staff.domain, "Hostel"),
            eq(staff.scope, location),
            eq(roles.name, "admin")
          )
        );
    }

    const staffMembers = await query;

    if (staffMembers.length === 0) {
      // Fallback: try to find any admin in the domain without scope requirement
      const fallback = await db
        .select({
          clerk_id: users.clerk_id,
        })
        .from(staff)
        .innerJoin(users, eq(staff.user_id, users.id))
        .innerJoin(user_roles, eq(users.id, user_roles.user_id))
        .innerJoin(roles, eq(user_roles.role_id, roles.id))
        .where(
          and(
            eq(staff.domain, category),
            eq(roles.name, "admin"),
            isNull(staff.scope)
          )
        );

      if (fallback.length > 0 && fallback[0].clerk_id) {
        return fallback[0].clerk_id;
      }

      return null;
    }

    // Simple round-robin: pick first available SPOC
    // TODO: Could implement load balancing based on ticket count
    if (staffMembers[0].clerk_id) {
      return staffMembers[0].clerk_id;
    }

    return null;
  } catch (error) {
    console.error("Error finding SPOC for ticket:", error);
    return null;
  }
}

