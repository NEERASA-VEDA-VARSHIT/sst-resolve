import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { categories, category_profile_fields } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

// GET: Fetch profile fields for a category (lazy loading)
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

    // Verify category exists - explicitly select columns to avoid Drizzle issues
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

    // Fetch profile field configurations for this category
    const profileFields = await db
      .select()
      .from(category_profile_fields)
      .where(eq(category_profile_fields.category_id, category.id))
      .orderBy(asc(category_profile_fields.display_order));

    // Map field_name to storage_key (form field key)
    const fieldNameToStorageKey: Record<string, string> = {
      rollNo: "contactRollNo",
      name: "contactName",
      email: "contactEmail",
      phone: "contactPhone",
      hostel: "location",
      roomNumber: "roomNumber",
      batchYear: "batchYear",
      classSection: "classSection",
    };

    return NextResponse.json({
      profileFields: profileFields.map(f => ({
        field_name: f.field_name,
        storage_key: fieldNameToStorageKey[f.field_name] || f.field_name,
        required: f.required,
        editable: f.editable,
        display_order: f.display_order,
      })),
    });
  } catch (error) {
    console.error("Error fetching profile fields:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

