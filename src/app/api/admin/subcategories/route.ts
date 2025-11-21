import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { subcategories, sub_subcategories, category_fields, field_options } from "@/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";

// GET: Fetch subcategories for a category
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await getOrCreateUser(userId);
    const role = await getUserRoleFromDB(userId);
    
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("category_id");
    const includeFields = searchParams.get("include_fields") === "true";

    if (!categoryId) {
      return NextResponse.json({ error: "category_id is required" }, { status: 400 });
    }

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
          eq(subcategories.category_id, parseInt(categoryId)),
          eq(subcategories.active, true)
        )
      )
      .orderBy(asc(subcategories.display_order), desc(subcategories.created_at));

    const includeSubSubcategories = searchParams.get("include_sub_subcategories") === "true";

    if (includeFields || includeSubSubcategories) {
      const subcatsWithData = await Promise.all(
        subcats.map(async (subcat) => {
          // Fetch sub-subcategories if requested
          let subSubcategories: any[] = [];
          if (includeSubSubcategories) {
            subSubcategories = await db
              .select()
              .from(sub_subcategories)
              .where(
                and(
                  eq(sub_subcategories.subcategory_id, subcat.id),
                  eq(sub_subcategories.active, true)
                )
              )
              .orderBy(asc(sub_subcategories.display_order), desc(sub_subcategories.created_at));
          }

          // Fetch fields if requested
          let fields: any[] = [];
          if (includeFields) {
            const fieldsData = await db
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

            const fieldsWithOptions = await Promise.all(
              fieldsData.map(async (field) => {
                if (field.field_type === "select") {
                  const options = await db
                    .select()
                    .from(field_options)
                    .where(eq(field_options.field_id, field.id))
                    .orderBy(asc(field_options.display_order), desc(field_options.created_at));
                  return { ...field, options };
                }
                return { ...field, options: [] };
              })
            );
            fields = fieldsWithOptions;
          }

          return {
            ...subcat,
            fields: includeFields ? fields : undefined,
            sub_subcategories: includeSubSubcategories ? subSubcategories : undefined,
          };
        })
      );

      return NextResponse.json(subcatsWithData);
    }

    return NextResponse.json(subcats);
  } catch (error) {
    console.error("Error fetching subcategories:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST: Create a new subcategory
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await getOrCreateUser(userId);
    const role = await getUserRoleFromDB(userId);
    
    if (role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { category_id, name, slug, description, display_order, assigned_admin_id } = body;

    if (!category_id || !name || !slug) {
      return NextResponse.json({ error: "category_id, name, and slug are required" }, { status: 400 });
    }

    // Check if an inactive item with the same slug exists
    const [existingInactive] = await db
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
          eq(subcategories.category_id, parseInt(category_id)),
          eq(subcategories.slug, slug),
          eq(subcategories.active, false)
        )
      )
      .limit(1);

    if (existingInactive) {
      // Reactivate the existing item
      const [reactivated] = await db
        .update(subcategories)
        .set({
          name,
          description: description || null,
          display_order: display_order || 0,
          assigned_admin_id: assigned_admin_id === null || assigned_admin_id === "" ? null : String(assigned_admin_id),
          active: true,
          updated_at: new Date(),
        })
        .where(eq(subcategories.id, existingInactive.id))
        .returning();
      return NextResponse.json(reactivated, { status: 201 });
    }

    const [newSubcategory] = await db
      .insert(subcategories)
      .values({
        category_id: parseInt(category_id),
        name,
        slug,
        description: description || null,
        display_order: display_order || 0,
        assigned_admin_id: assigned_admin_id === null || assigned_admin_id === "" ? null : String(assigned_admin_id),
        active: true,
      })
      .returning();

    return NextResponse.json(newSubcategory, { status: 201 });
  } catch (error: any) {
    console.error("Error creating subcategory:", error);
    if (error.code === "23505") {
      return NextResponse.json({ error: "Subcategory slug already exists for this category" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

