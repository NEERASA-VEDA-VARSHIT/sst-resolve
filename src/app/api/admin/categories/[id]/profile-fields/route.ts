import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, category_profile_fields, categories } from "@/db";
import { eq } from "drizzle-orm";
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

		// Get profile field configurations for this category - explicit columns
		const profileFields = await db
			.select({
				id: category_profile_fields.id,
				category_id: category_profile_fields.category_id,
				field_name: category_profile_fields.field_name,
				required: category_profile_fields.required,
				editable: category_profile_fields.editable,
				display_order: category_profile_fields.display_order,
				created_at: category_profile_fields.created_at,
			})
			.from(category_profile_fields)
			.where(eq(category_profile_fields.category_id, categoryId));

		// Sort manually to avoid orderBy issues
		const sortedProfileFields = profileFields.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

		return NextResponse.json({ profileFields: sortedProfileFields });
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

		// Return updated configurations - explicit columns
		const updatedFields = await db
			.select({
				id: category_profile_fields.id,
				category_id: category_profile_fields.category_id,
				field_name: category_profile_fields.field_name,
				required: category_profile_fields.required,
				editable: category_profile_fields.editable,
				display_order: category_profile_fields.display_order,
				created_at: category_profile_fields.created_at,
			})
			.from(category_profile_fields)
			.where(eq(category_profile_fields.category_id, categoryId));

		// Sort manually to avoid orderBy issues
		const sortedUpdatedFields = updatedFields.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

		return NextResponse.json({ profileFields: sortedUpdatedFields });
	} catch (error) {
		console.error("Error setting category profile fields:", error);
		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 }
		);
	}
}
