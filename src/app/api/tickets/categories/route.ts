import { NextResponse } from "next/server";
import { db } from "@/db";
import { categories, subcategories } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * ============================================
 * /api/tickets/categories
 * ============================================
 * 
 * GET → Get Categories Schema
 *   - Auth: Required
 *   - Returns complete category structure:
 *     • Categories
 *     • Subcategories
 *     • Sub-subcategories
 *     • Dynamic fields (by subcategory)
 *     • Profile fields (by category)
 *     • Field options (for dropdowns)
 *   - Use Case: Powers the dynamic create-ticket form
 *   - Returns: 200 OK with nested category structure
 * ============================================
 */

export async function GET() {
  try {
    // 1. Fetch all active categories
    const categoryRows = await db
      .select({
        id: categories.id,
        name: categories.name,
        active: categories.active,
      })
      .from(categories)
      .where(eq(categories.active, true));

    if (categoryRows.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    // 2. Fetch all active subcategories
    const subcategoryRows = await db
      .select({
        id: subcategories.id,
        name: subcategories.name,
        category_id: subcategories.category_id,
        active: subcategories.is_active,
      })
      .from(subcategories)
      .where(eq(subcategories.is_active, true));

    // 3. Organize into hierarchical structure
    const result = categoryRows.map((cat) => {
      const subs = subcategoryRows.filter(
        (s) => s.category_id === cat.id
      );

      return {
        id: cat.id,
        name: cat.name,
        subcategories: subs.map((s) => ({
          id: s.id,
          name: s.name,
        })),
      };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("Error fetching categories:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
