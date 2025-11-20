import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { categories, subcategories, sub_subcategories, category_fields, field_options } from "@/db/schema";
import { eq, desc, asc, and } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";

// GET: Fetch all categories with their subcategories and fields
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await getOrCreateUser(userId);
    const role = await getUserRoleFromDB(userId);
    
    // Allow admins and super admins to view categories
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("include_inactive") === "true";
    const categoryId = searchParams.get("category_id");

    if (categoryId) {
      // Fetch single category with full hierarchy - explicitly select columns to avoid Drizzle issues
      const [category] = await db
        .select({
          id: categories.id,
          name: categories.name,
          slug: categories.slug,
          description: categories.description,
          icon: categories.icon,
          color: categories.color,
          sla_hours: categories.sla_hours,
          default_authority: categories.default_authority,
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

      if (!category) {
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
            includeInactive ? undefined : eq(subcategories.active, true)
          )
        )
        .orderBy(asc(subcategories.display_order), desc(subcategories.created_at));

      // Fetch sub-subcategories and fields for each subcategory
      const subcatsWithData = await Promise.all(
        subcats.map(async (subcat) => {
          const subSubcats = await db
            .select()
            .from(sub_subcategories)
            .where(
              and(
                eq(sub_subcategories.subcategory_id, subcat.id),
                includeInactive ? undefined : eq(sub_subcategories.active, true)
              )
            )
            .orderBy(asc(sub_subcategories.display_order), desc(sub_subcategories.created_at));

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
                includeInactive ? undefined : eq(category_fields.active, true)
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
                  .where(eq(field_options.field_id, field.id))
                  .orderBy(asc(field_options.display_order), desc(field_options.created_at));
                return { ...field, options };
              }
              return { ...field, options: [] };
            })
          );

          return {
            ...subcat,
            sub_subcategories: subSubcats,
            fields: fieldsWithOptions,
          };
        })
      );

      return NextResponse.json({
        ...category,
        subcategories: subcatsWithData,
      });
    }

    // Fetch all categories - explicitly select columns to avoid Drizzle issues
    const allCategories = await db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        description: categories.description,
        icon: categories.icon,
        color: categories.color,
        sla_hours: categories.sla_hours,
        default_authority: categories.default_authority,
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
      .where(includeInactive ? undefined : eq(categories.active, true))
      .orderBy(asc(categories.display_order), desc(categories.created_at));

    return NextResponse.json(allCategories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST: Create a new category
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await getOrCreateUser(userId);
    const role = await getUserRoleFromDB(userId);
    
    // Only super admin can create categories
    if (role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, slug, description, icon, color, sla_hours, display_order, default_authority } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });
    }

    const [newCategory] = await db
      .insert(categories)
      .values({
        name,
        slug,
        description: description || null,
        icon: icon || null,
        color: color || null,
        sla_hours: sla_hours || 48,
        display_order: display_order || 0,
        default_authority: default_authority === null || default_authority === "" ? null : parseInt(String(default_authority)) || null,
        active: true,
      })
      .returning();

    return NextResponse.json(newCategory, { status: 201 });
  } catch (error: any) {
    console.error("Error creating category:", error);
    if (error.code === "23505") {
      return NextResponse.json({ error: "Category slug already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

