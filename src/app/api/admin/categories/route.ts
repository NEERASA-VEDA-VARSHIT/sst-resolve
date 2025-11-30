import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { categories, subcategories, sub_subcategories, category_fields, field_options } from "@/db/schema";
import { eq, desc, asc, and } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";

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
      const parsedCategoryId = parseInt(categoryId);
      if (isNaN(parsedCategoryId) || parsedCategoryId <= 0) {
        return NextResponse.json({ error: "Invalid category ID" }, { status: 400 });
      }
      
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
          domain_id: categories.domain_id,
          scope_id: categories.scope_id,
          default_admin_id: categories.default_admin_id,
          parent_category_id: categories.parent_category_id,
          is_active: categories.is_active,
          display_order: categories.display_order,
          created_at: categories.created_at,
          updated_at: categories.updated_at,
        })
        .from(categories)
        .where(eq(categories.id, parsedCategoryId))
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
          is_active: subcategories.is_active,
          display_order: subcategories.display_order,
          created_at: subcategories.created_at,
          updated_at: subcategories.updated_at,
        })
        .from(subcategories)
        .where(
          and(
            eq(subcategories.category_id, category.id),
            includeInactive ? undefined : eq(subcategories.is_active, true)
          )
        )
        .orderBy(asc(subcategories.display_order), desc(subcategories.created_at));

      // Fetch sub-subcategories and fields for each subcategory
      const subcatsWithData = await Promise.all(
        subcats.map(async (subcat) => {
          const subSubcats = await db
            .select({
              id: sub_subcategories.id,
              subcategory_id: sub_subcategories.subcategory_id,
              name: sub_subcategories.name,
              slug: sub_subcategories.slug,
              description: sub_subcategories.description,
              is_active: sub_subcategories.is_active,
              display_order: sub_subcategories.display_order,
              created_at: sub_subcategories.created_at,
              updated_at: sub_subcategories.updated_at,
            })
            .from(sub_subcategories)
            .where(
              and(
                eq(sub_subcategories.subcategory_id, subcat.id),
                includeInactive ? undefined : eq(sub_subcategories.is_active, true)
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
              is_active: category_fields.is_active,
              created_at: category_fields.created_at,
              updated_at: category_fields.updated_at,
            })
            .from(category_fields)
            .where(
              and(
                eq(category_fields.subcategory_id, subcat.id),
                includeInactive ? undefined : eq(category_fields.is_active, true)
              )
            )
            .orderBy(asc(category_fields.display_order), desc(category_fields.created_at));

          // Fetch options for select fields
          const fieldsWithOptions = await Promise.all(
            fields.map(async (field) => {
              if (field.field_type === "select") {
                const options = await db
                  .select({
                    id: field_options.id,
                    field_id: field_options.field_id,
                    value: field_options.value,
                    label: field_options.label,
                    display_order: field_options.display_order,
                    created_at: field_options.created_at,
                    updated_at: field_options.updated_at,
                  })
                  .from(field_options)
                  .where(eq(field_options.field_id, field.id))
                  .orderBy(asc(field_options.display_order), desc(field_options.created_at));
                return { ...field, options };
              }
              return { ...field, options: [] };
            })
          );

          // Transform is_active to active for frontend compatibility
          const transformedSubcat: Record<string, unknown> = {
            ...subcat,
            active: subcat.is_active,
          };
          delete transformedSubcat.is_active;

          transformedSubcat.sub_subcategories = subSubcats.map(subSubcat => {
            const { is_active, ...rest } = subSubcat;
            return { ...rest, active: is_active };
          });

          transformedSubcat.fields = fieldsWithOptions.map(field => {
            const { is_active, ...rest } = field;
            return { ...rest, active: is_active };
          });

          return transformedSubcat;
        })
      );

      // Transform is_active to active for frontend compatibility
      const { is_active, ...categoryRest } = category;
      const transformedCategory = {
        ...categoryRest,
        active: is_active,
        subcategories: subcatsWithData,
      };
      
      return NextResponse.json(transformedCategory);
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
        domain_id: categories.domain_id,
        scope_id: categories.scope_id,
        default_admin_id: categories.default_admin_id,
        parent_category_id: categories.parent_category_id,
        is_active: categories.is_active,
        display_order: categories.display_order,
        created_at: categories.created_at,
        updated_at: categories.updated_at,
      })
      .from(categories)
      .where(includeInactive ? undefined : eq(categories.is_active, true))
      .orderBy(asc(categories.display_order), desc(categories.created_at));

    // Transform is_active to active for frontend compatibility
    const transformedCategories = allCategories.map(cat => {
      const { is_active, ...rest } = cat;
      return { ...rest, active: is_active };
    });

    return NextResponse.json(transformedCategories);
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
    const { name, slug, description, icon, color, sla_hours, display_order, default_admin_id, domain_id, scope_id } = body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required and must be a non-empty string" }, { status: 400 });
    }

    if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
      return NextResponse.json({ error: "Slug is required and must be a non-empty string" }, { status: 400 });
    }

    // Validate slug format (alphanumeric, hyphens, underscores only)
    if (!/^[a-z0-9_-]+$/.test(slug.trim())) {
      return NextResponse.json({ error: "Slug must contain only lowercase letters, numbers, hyphens, and underscores" }, { status: 400 });
    }

    if (domain_id === undefined || domain_id === null) {
      return NextResponse.json({ error: "Domain ID is required" }, { status: 400 });
    }

    const parsedDomainId = parseInt(String(domain_id));
    if (isNaN(parsedDomainId) || parsedDomainId <= 0) {
      return NextResponse.json({ error: "Domain ID must be a positive integer" }, { status: 400 });
    }

    // Validate optional fields
    if (scope_id !== undefined && scope_id !== null && scope_id !== "") {
      const parsedScopeId = parseInt(String(scope_id));
      if (isNaN(parsedScopeId) || parsedScopeId <= 0) {
        return NextResponse.json({ error: "Scope ID must be a positive integer if provided" }, { status: 400 });
      }
    }

    if (sla_hours !== undefined && (typeof sla_hours !== 'number' || sla_hours < 0)) {
      return NextResponse.json({ error: "SLA hours must be a non-negative number" }, { status: 400 });
    }

    if (display_order !== undefined && (typeof display_order !== 'number' || display_order < 0)) {
      return NextResponse.json({ error: "Display order must be a non-negative number" }, { status: 400 });
    }

    // Validate default_admin_id if provided (must be valid UUID format)
    if (default_admin_id !== undefined && default_admin_id !== null && default_admin_id !== "") {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (typeof default_admin_id !== 'string' || !uuidRegex.test(default_admin_id)) {
        return NextResponse.json({ error: "Default admin ID must be a valid UUID format" }, { status: 400 });
      }
    }

    const [newCategory] = await db
      .insert(categories)
      .values({
        name: name.trim(),
        slug: slug.trim(),
        description: description && typeof description === 'string' ? description.trim() || null : null,
        icon: icon && typeof icon === 'string' ? icon.trim() || null : null,
        color: color && typeof color === 'string' ? color.trim() || null : null,
        domain_id: parsedDomainId,
        scope_id: scope_id && scope_id !== "" ? parseInt(String(scope_id)) : null,
        default_admin_id: default_admin_id && default_admin_id !== "" ? String(default_admin_id) : null,
        sla_hours: sla_hours && typeof sla_hours === 'number' ? sla_hours : 48,
        display_order: display_order && typeof display_order === 'number' ? display_order : 0,
        is_active: true,
      })
      .returning();

    // Transform is_active to active for frontend compatibility
    const { is_active, ...rest } = newCategory;
    return NextResponse.json({ ...rest, active: is_active }, { status: 201 });
  } catch (error) {
    console.error("Error creating category:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "23505") {
      return NextResponse.json({ error: "Category slug already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}


