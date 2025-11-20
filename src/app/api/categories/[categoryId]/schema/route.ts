import { NextRequest, NextResponse } from "next/server";
import { db, categories, subcategories, category_fields, field_options, sub_subcategories } from "@/db";
import { eq, and, asc, sql } from "drizzle-orm";

// Cache category schemas in memory (simple in-memory cache)
// In production, use Redis or a proper caching layer
const schemaCache = new Map<number, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/categories/[categoryId]/schema
 * Returns complete category schema including subcategories, fields, and options
 * Cached for performance
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    const { categoryId: categoryIdParam } = await params;
    const categoryId = parseInt(categoryIdParam);

    if (!categoryId || isNaN(categoryId)) {
      return NextResponse.json(
        { error: "Invalid category ID" },
        { status: 400 }
      );
    }

    // Check cache first
    const cached = schemaCache.get(categoryId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({
        ...cached.data,
        cached: true,
        cacheAge: Math.floor((Date.now() - cached.timestamp) / 1000),
      });
    }

    // Fetch category
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);

    if (!category || !category.active) {
      return NextResponse.json(
        { error: "Category not found or inactive" },
        { status: 404 }
      );
    }

    // Fetch all subcategories for this category
    const subcategoriesResult = await db.execute(sql`
      SELECT id, category_id, name, slug, description, active, display_order, created_at, updated_at
      FROM subcategories
      WHERE category_id = ${categoryId}
        AND active = true
      ORDER BY display_order ASC, created_at DESC
    `);

    const subcategoriesData = subcategoriesResult.map((row: any) => ({
      id: row.id,
      category_id: row.category_id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      active: row.active,
      display_order: row.display_order,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    // Fetch sub-subcategories for all subcategories
    const subcategoryIds = subcategoriesData.map((sc) => sc.id);
    let subSubcategoriesData: any[] = [];
    
    if (subcategoryIds.length > 0) {
      const subSubcatsResult = await db.execute(sql`
        SELECT id, subcategory_id, name, slug, description, active, display_order, created_at, updated_at
        FROM sub_subcategories
        WHERE subcategory_id = ANY(${sql.raw(`ARRAY[${subcategoryIds.join(',')}]`)})
          AND active = true
        ORDER BY display_order ASC
      `);

      subSubcategoriesData = subSubcatsResult.map((row: any) => ({
        id: row.id,
        subcategory_id: row.subcategory_id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        active: row.active,
        display_order: row.display_order,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
    }

    // Fetch all fields for all subcategories in one query
    let fieldsData: any[] = [];
    if (subcategoryIds.length > 0) {
      const fieldsResult = await db.execute(sql`
        SELECT id, subcategory_id, name, slug, field_type, required, placeholder, help_text, validation_rules, display_order, active, created_at, updated_at
        FROM category_fields
        WHERE subcategory_id = ANY(${sql.raw(`ARRAY[${subcategoryIds.join(',')}]`)})
          AND active = true
        ORDER BY display_order ASC
      `);

      fieldsData = fieldsResult.map((row: any) => ({
        id: row.id,
        subcategory_id: row.subcategory_id,
        name: row.name,
        slug: row.slug,
        field_type: row.field_type,
        required: row.required,
        placeholder: row.placeholder,
        help_text: row.help_text,
        validation_rules: row.validation_rules,
        display_order: row.display_order,
        active: row.active,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
    }

    // Fetch all options for all select fields in one query
    const fieldIds = fieldsData.filter((f) => f.field_type === "select").map((f) => f.id);
    let optionsData: any[] = [];

    if (fieldIds.length > 0) {
      const optionsResult = await db.execute(sql`
        SELECT id, field_id, label, value, display_order, active, created_at
        FROM field_options
        WHERE field_id = ANY(${sql.raw(`ARRAY[${fieldIds.join(',')}]`)})
          AND active = true
        ORDER BY display_order ASC
      `);

      optionsData = optionsResult.map((row: any) => ({
        id: row.id,
        field_id: row.field_id,
        label: row.label,
        value: row.value,
        display_order: row.display_order,
        active: row.active,
        created_at: row.created_at,
      }));
    }

    // Build the complete schema structure
    const schema = {
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        icon: category.icon,
        color: category.color,
        sla_hours: category.sla_hours,
      },
      subcategories: subcategoriesData.map((subcat) => ({
        ...subcat,
        sub_subcategories: subSubcategoriesData.filter(
          (ssc) => ssc.subcategory_id === subcat.id
        ),
        fields: fieldsData
          .filter((field) => field.subcategory_id === subcat.id)
          .map((field) => ({
            ...field,
            options: optionsData.filter((opt) => opt.field_id === field.id),
          })),
      })),
    };

    // Cache the result
    schemaCache.set(categoryId, {
      data: schema,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      ...schema,
      cached: false,
    });
  } catch (error) {
    console.error("Error fetching category schema:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/categories/[categoryId]/schema
 * Invalidate cache for this category (admin use after schema updates)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    const { categoryId: categoryIdParam } = await params;
    const categoryId = parseInt(categoryIdParam);

    if (!categoryId || isNaN(categoryId)) {
      return NextResponse.json(
        { error: "Invalid category ID" },
        { status: 400 }
      );
    }

    schemaCache.delete(categoryId);

    return NextResponse.json({
      message: "Cache invalidated",
      categoryId,
    });
  } catch (error) {
    console.error("Error invalidating cache:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
