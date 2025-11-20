import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { categories, subcategories, sub_subcategories, category_fields, field_options } from "@/db/schema";
import { eq, and, asc, desc } from "drizzle-orm";

// GET: Fetch subcategories for a category (fast, without profile fields)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("category_id");

    if (!categoryId) {
      return NextResponse.json(
        { error: "category_id is required" },
        { status: 400 }
      );
    }

    // Fetch category
    const [category] = await db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        description: categories.description,
        icon: categories.icon,
        color: categories.color,
        sla_hours: categories.sla_hours,
        poc_name: categories.poc_name,
        poc_slack_id: categories.poc_slack_id,
        committee_id: categories.committee_id,
        parent_category_id: categories.parent_category_id,
        active: categories.active,
        display_order: categories.display_order,
        created_at: categories.created_at,
        updated_at: categories.updated_at,
      })
      .from(categories)
      .where(eq(categories.id, parseInt(categoryId)))
      .limit(1);

    if (!category || !category.active) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Fetch subcategories - explicitly select columns to avoid Drizzle issues
    const subcats = await db
      .select({
        id: subcategories.id,
        category_id: subcategories.category_id,
        name: subcategories.name,
        slug: subcategories.slug,
        description: subcategories.description,
        active: subcategories.active,
        display_order: subcategories.display_order,
        created_at: subcategories.created_at,
        updated_at: subcategories.updated_at,
      })
      .from(subcategories)
      .where(
        and(
          eq(subcategories.category_id, category.id),
          eq(subcategories.active, true)
        )
      )
      .orderBy(asc(subcategories.display_order), desc(subcategories.created_at));

    // Fetch sub-subcategories and fields for each subcategory (but not profile fields)
    const subcatsWithData = await Promise.all(
      subcats.map(async (subcat) => {
        // Fetch sub-subcategories
        const subSubcats = await db
          .select()
          .from(sub_subcategories)
          .where(
            and(
              eq(sub_subcategories.subcategory_id, subcat.id),
              eq(sub_subcategories.active, true)
            )
          )
          .orderBy(asc(sub_subcategories.display_order), desc(sub_subcategories.created_at));

        // Fetch fields - explicitly select columns to avoid Drizzle issues
        const fields = await db
          .select({
            id: category_fields.id,
            subcategory_id: category_fields.subcategory_id,
            name: category_fields.name,
            slug: category_fields.slug,
            field_type: category_fields.field_type,
            required: category_fields.required,
            placeholder: category_fields.placeholder,
            help_text: category_fields.help_text,
            validation_rules: category_fields.validation_rules,
            display_order: category_fields.display_order,
            active: category_fields.active,
            created_at: category_fields.created_at,
            updated_at: category_fields.updated_at,
          })
          .from(category_fields)
          .where(
            and(
              eq(category_fields.subcategory_id, subcat.id),
              eq(category_fields.active, true)
            )
          )
          .orderBy(asc(category_fields.display_order), desc(category_fields.created_at));

        // Fetch options for select fields
        const fieldsWithOptions = await Promise.all(
          fields.map(async (field) => {
            if (field.field_type === "select") {
              const options = await db
                .select()
                .from(field_options)
                .where(
                  and(
                    eq(field_options.field_id, field.id),
                    eq(field_options.active, true)
                  )
                )
                .orderBy(asc(field_options.display_order), desc(field_options.created_at));
              return { ...field, options };
            }
            return { ...field, options: [] };
          })
        );

        return {
          ...subcat,
          fields: fieldsWithOptions,
          sub_subcategories: subSubcats,
        };
      })
    );

    return NextResponse.json({
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        icon: category.icon,
        color: category.color,
        sla_hours: category.sla_hours,
      },
      subcategories: subcatsWithData,
    });
  } catch (error) {
    console.error("Error fetching subcategories:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

