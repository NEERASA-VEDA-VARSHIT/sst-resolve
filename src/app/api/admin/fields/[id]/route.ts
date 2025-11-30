import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { category_fields, field_options } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import type { InferSelectModel } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const fieldId = parseInt(id);
    if (isNaN(fieldId)) {
      return NextResponse.json({ error: "Invalid field ID" }, { status: 400 });
    }

    const body = await request.json();
    type FieldUpdate = Partial<InferSelectModel<typeof category_fields>> & {
      updated_at: Date;
    };
    const updateData: FieldUpdate = { updated_at: new Date() };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.field_type !== undefined) updateData.field_type = body.field_type;
    if (body.required !== undefined) updateData.required = body.required;
    if (body.placeholder !== undefined) updateData.placeholder = body.placeholder;
    if (body.help_text !== undefined) updateData.help_text = body.help_text;
    if (body.validation_rules !== undefined) updateData.validation_rules = body.validation_rules;
    if (body.display_order !== undefined) updateData.display_order = body.display_order;
    if (body.active !== undefined) updateData.is_active = body.active;
    if (body.assigned_admin_id !== undefined) {
      updateData.assigned_admin_id = body.assigned_admin_id === null || body.assigned_admin_id === "" ? null : String(body.assigned_admin_id);
    }

    const [updated] = await db
      .update(category_fields)
      .set(updateData)
      .where(eq(category_fields.id, fieldId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Field not found" }, { status: 404 });
    }

    // Update options if provided
    if (body.options && Array.isArray(body.options)) {
      // Validate for duplicate values (case-insensitive) before deleting existing
      if (body.options.length > 0) {
        const valueSet = new Set<string>();
        const duplicates: string[] = [];
        for (const opt of body.options) {
          const normalizedValue = String(opt.value || "").trim().toLowerCase();
          if (!normalizedValue) {
            return NextResponse.json({ 
              error: "Option values cannot be empty" 
            }, { status: 400 });
          }
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
      }

      // Delete existing options
      await db.delete(field_options).where(eq(field_options.field_id, fieldId));

      // Insert new options
      if (body.options.length > 0) {
        type OptionInput = {
          label?: string;
          value: string;
          display_order?: number;
          active?: boolean;
        };
        const optionValues = body.options.map((opt: OptionInput, index: number) => ({
          field_id: fieldId,
          label: opt.label || opt.value,
          value: String(opt.value).trim(), // Trim whitespace
          display_order: opt.display_order || index,
          active: opt.active !== false,
        }));

        await db.insert(field_options).values(optionValues);
      }
    }

    // Fetch updated field with options
    const fieldOptions = await db
      .select()
      .from(field_options)
      .where(eq(field_options.field_id, fieldId))
      .orderBy(asc(field_options.display_order));

    return NextResponse.json({ ...updated, options: fieldOptions });
  } catch (error) {
    console.error("Error updating field:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "23505") {
      return NextResponse.json({ error: "Field slug already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const fieldId = parseInt(id);
    if (isNaN(fieldId)) {
      return NextResponse.json({ error: "Invalid field ID" }, { status: 400 });
    }

    // Delete options first (safe even though field_options has cascade)
    await db.delete(field_options).where(eq(field_options.field_id, fieldId));

    const [deletedField] = await db
      .delete(category_fields)
      .where(eq(category_fields.id, fieldId))
      .returning({ name: category_fields.name });

    if (!deletedField) {
      return NextResponse.json({ error: "Field not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Field "${deletedField.name}" deleted successfully.`,
    });
  } catch (error) {
    console.error("Error deleting field:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

