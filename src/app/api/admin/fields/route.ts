import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { category_fields, field_options } from "@/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";

const CHOICE_FIELD_TYPES = new Set(["select", "multi_select"]);

// GET: Fetch fields for a subcategory
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
    const subcategoryId = searchParams.get("subcategory_id");

    if (!subcategoryId) {
      return NextResponse.json({ error: "subcategory_id is required" }, { status: 400 });
    }

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
        created_at: category_fields.created_at,
        updated_at: category_fields.updated_at,
      })
      .from(category_fields)
      .where(eq(category_fields.subcategory_id, parseInt(subcategoryId)))
      .orderBy(asc(category_fields.display_order), desc(category_fields.created_at));

    const fieldsWithOptions = await Promise.all(
      fields.map(async (field) => {
        if (CHOICE_FIELD_TYPES.has(field.field_type)) {
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

    return NextResponse.json(fieldsWithOptions);
  } catch (error) {
    console.error("Error fetching fields:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST: Create a new field
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
    const {
      subcategory_id,
      name,
      slug,
      field_type,
      required,
      placeholder,
      help_text,
      validation_rules,
      display_order,
      assigned_admin_id,
      options, // Array of { label, value } for select fields
    } = body;

    const isChoiceField = CHOICE_FIELD_TYPES.has(field_type);
    const normalizedValidationRules =
      field_type === "multi_select"
        ? { ...(validation_rules || {}), multiSelect: true }
        : validation_rules || null;

    if (!subcategory_id || !name || !slug || !field_type) {
      return NextResponse.json(
        { error: "subcategory_id, name, slug, and field_type are required" },
        { status: 400 }
      );
    }

    // Check if a field with the same slug exists (active or inactive)
    const [existingField] = await db
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
          eq(category_fields.subcategory_id, parseInt(subcategory_id)),
          eq(category_fields.slug, slug)
        )
      )
      .limit(1);

    // If an active field exists with the same slug, generate a unique slug
    let finalSlug = slug;
    if (existingField && existingField.is_active) {
      // Find all fields with slugs starting with the base slug to generate a unique one
      const allFields = await db
        .select({ slug: category_fields.slug })
        .from(category_fields)
        .where(eq(category_fields.subcategory_id, parseInt(subcategory_id)));

      // Generate unique slug by appending a number
      let counter = 2;
      let candidateSlug = `${slug}-${counter}`;
      while (allFields.some(f => f.slug === candidateSlug)) {
        counter++;
        candidateSlug = `${slug}-${counter}`;
      }
      finalSlug = candidateSlug;
    }

    let newField;
    if (existingField && !existingField.is_active) {
      // Reactivate the existing inactive item
      [newField] = await db
        .update(category_fields)
        .set({
          name,
          slug: finalSlug, // Use the final slug (might be auto-generated)
          field_type,
          required: required || false,
          placeholder: placeholder || null,
          help_text: help_text || null,
          validation_rules: normalizedValidationRules,
          display_order: display_order || 0,
          assigned_admin_id: assigned_admin_id === null || assigned_admin_id === "" ? null : String(assigned_admin_id),
          is_active: true,
          updated_at: new Date(),
        })
        .where(eq(category_fields.id, existingField.id))
        .returning();
      
      // Delete old options and recreate them
      await db.delete(field_options).where(eq(field_options.field_id, existingField.id));
    } else {
      // Create the field with the final slug (auto-generated if needed)
      [newField] = await db
        .insert(category_fields)
        .values({
          subcategory_id: parseInt(subcategory_id),
          name,
          slug: finalSlug,
          field_type,
          required: required || false,
          placeholder: placeholder || null,
          help_text: help_text || null,
          validation_rules: normalizedValidationRules,
          display_order: display_order || 0,
          assigned_admin_id: assigned_admin_id === null || assigned_admin_id === "" ? null : String(assigned_admin_id),
          is_active: true,
        })
        .returning();
    }

    // Create options if field_type is "select" and options are provided
    type FieldOption = { label?: string; value: string; display_order?: number };
    if (isChoiceField && Array.isArray(options) && options.length > 0) {
      // Validate for duplicate values (case-insensitive)
      const valueSet = new Set<string>();
      const duplicates: string[] = [];
      for (const opt of options) {
        const normalizedValue = opt.value.trim().toLowerCase();
        if (valueSet.has(normalizedValue)) {
          duplicates.push(opt.value);
        }
        valueSet.add(normalizedValue);
      }
      
      if (duplicates.length > 0) {
        return NextResponse.json({ 
          error: `Duplicate option values detected: ${duplicates.join(", ")}. Each option must have a unique value (case-insensitive).` 
        }, { status: 400 });
      }

      const optionValues = options.map((opt: FieldOption, index: number) => ({
        field_id: newField.id,
        label: opt.label || opt.value,
        value: opt.value.trim(), // Trim whitespace
        display_order: opt.display_order || index,
        is_active: true,
      }));

      await db.insert(field_options).values(optionValues);
    }

    // Transform is_active to active for frontend compatibility
    const { is_active, ...fieldRest } = newField;
    const transformedField = { ...fieldRest, active: is_active };

    // Fetch the field with options
    if (isChoiceField) {
      const fieldOptions = await db
        .select()
        .from(field_options)
        .where(eq(field_options.field_id, newField.id))
        .orderBy(asc(field_options.display_order));
      return NextResponse.json({ 
        ...transformedField, 
        options: fieldOptions,
        slug_auto_generated: finalSlug !== slug // Indicate if slug was auto-generated
      }, { status: 201 });
    }

    return NextResponse.json({ 
      ...transformedField, 
      options: [],
      slug_auto_generated: finalSlug !== slug // Indicate if slug was auto-generated
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating field:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "23505") {
      return NextResponse.json({ error: "Field slug already exists for this subcategory" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

