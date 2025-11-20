import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, category_profile_fields, categories } from "@/db";
import { eq, and } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";

// GET - Get profile field configuration for a category
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { userId } = await auth();
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const role = await getUserRoleFromDB(userId);
		if (role !== "super_admin") {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const { id } = await params;
		const categoryId = parseInt(id);
		if (isNaN(categoryId)) {
			return NextResponse.json({ error: "Invalid category ID" }, { status: 400 });
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
			.where(eq(categories.id, categoryId))
			.limit(1);

		if (!category) {
			return NextResponse.json({ error: "Category not found" }, { status: 404 });
		}

		// Get profile field configurations for this category
		const profileFields = await db
			.select()
			.from(category_profile_fields)
			.where(eq(category_profile_fields.category_id, categoryId))
			.orderBy(category_profile_fields.display_order);

		return NextResponse.json({ profileFields });
	} catch (error) {
		console.error("Error fetching category profile fields:", error);
		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 }
		);
	}
}

// POST - Set profile field configuration for a category
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { userId } = await auth();
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const role = await getUserRoleFromDB(userId);
		if (role !== "super_admin") {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const { id } = await params;
		const categoryId = parseInt(id);
		if (isNaN(categoryId)) {
			return NextResponse.json({ error: "Invalid category ID" }, { status: 400 });
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
			.where(eq(categories.id, categoryId))
			.limit(1);

		if (!category) {
			return NextResponse.json({ error: "Category not found" }, { status: 404 });
		}

		const body = await request.json();
		const { fields } = body; // Array of { field_name, required, editable, display_order }

		if (!Array.isArray(fields)) {
			return NextResponse.json(
				{ error: "Fields must be an array" },
				{ status: 400 }
			);
		}

		// Validate field names
		const validFieldNames = [
			"rollNo",
			"name",
			"email",
			"phone",
			"hostel",
			"roomNumber",
			"batchYear",
			"classSection",
		];

		for (const field of fields) {
			if (!validFieldNames.includes(field.field_name)) {
				return NextResponse.json(
					{ error: `Invalid field name: ${field.field_name}` },
					{ status: 400 }
				);
			}
		}

		// Delete existing configurations for this category
		await db
			.delete(category_profile_fields)
			.where(eq(category_profile_fields.category_id, categoryId));

		// Insert new configurations
		if (fields.length > 0) {
			await db.insert(category_profile_fields).values(
				fields.map((field: any, index: number) => ({
					category_id: categoryId,
					field_name: field.field_name,
					required: field.required ?? false,
					editable: field.editable ?? true,
					display_order: field.display_order ?? index,
				}))
			);
		}

		// Return updated configurations
		const updatedFields = await db
			.select()
			.from(category_profile_fields)
			.where(eq(category_profile_fields.category_id, categoryId))
			.orderBy(category_profile_fields.display_order);

		return NextResponse.json({ profileFields: updatedFields });
	} catch (error) {
		console.error("Error setting category profile fields:", error);
		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 }
		);
	}
}

