import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { category_fields, field_options } from "@/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";

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

    if (!subcategory_id || !name || !slug || !field_type) {
      return NextResponse.json(
        { error: "subcategory_id, name, slug, and field_type are required" },
        { status: 400 }
      );
    }

    // Check if an inactive item with the same slug exists
    const [existingInactive] = await db
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
          eq(category_fields.subcategory_id, parseInt(subcategory_id)),
          eq(category_fields.slug, slug),
          eq(category_fields.active, false)
        )
      )
      .limit(1);

    let newField;
    if (existingInactive) {
      // Reactivate the existing item
      [newField] = await db
        .update(category_fields)
        .set({
          name,
          field_type,
          required: required || false,
          placeholder: placeholder || null,
          help_text: help_text || null,
          validation_rules: validation_rules || null,
          display_order: display_order || 0,
          assigned_admin_id: assigned_admin_id === null || assigned_admin_id === "" ? null : String(assigned_admin_id),
          active: true,
          updated_at: new Date(),
        })
        .where(eq(category_fields.id, existingInactive.id))
        .returning();
      
      // Delete old options and recreate them
      await db.delete(field_options).where(eq(field_options.field_id, existingInactive.id));
    } else {
      // Create the field
      [newField] = await db
        .insert(category_fields)
        .values({
          subcategory_id: parseInt(subcategory_id),
          name,
          slug,
          field_type,
          required: required || false,
          placeholder: placeholder || null,
          help_text: help_text || null,
          validation_rules: validation_rules || null,
          display_order: display_order || 0,
          assigned_admin_id: assigned_admin_id === null || assigned_admin_id === "" ? null : String(assigned_admin_id),
          active: true,
        })
        .returning();
    }

    // Create options if field_type is "select" and options are provided
    if (field_type === "select" && Array.isArray(options) && options.length > 0) {
      const optionValues = options.map((opt: any, index: number) => ({
        field_id: newField.id,
        label: opt.label || opt.value,
        value: opt.value,
        display_order: opt.display_order || index,
        active: true,
      }));

      await db.insert(field_options).values(optionValues);
    }

    // Fetch the field with options
    if (field_type === "select") {
      const fieldOptions = await db
        .select()
        .from(field_options)
        .where(eq(field_options.field_id, newField.id))
        .orderBy(field_options.display_order);
      return NextResponse.json({ ...newField, options: fieldOptions }, { status: 201 });
    }

    return NextResponse.json({ ...newField, options: [] }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating field:", error);
    if (error.code === "23505") {
      return NextResponse.json({ error: "Field slug already exists for this subcategory" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

