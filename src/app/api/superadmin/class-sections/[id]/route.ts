/**
 * GET /api/superadmin/class-sections/[id]
 * PATCH /api/superadmin/class-sections/[id]
 * DELETE /api/superadmin/class-sections/[id]
 * 
 * Manage individual class section
 * SuperAdmin-only endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { class_sections, students } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";

// GET - Get single class section by ID
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { userId } = await auth();
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Ensure user is super_admin
		await getOrCreateUser(userId);
		const role = await getUserRoleFromDB(userId);
		if (role !== "super_admin") {
			return NextResponse.json({ error: "Forbidden: Super admin only" }, { status: 403 });
		}

		const { id } = await params;
		const sectionId = parseInt(id);

		if (isNaN(sectionId)) {
			return NextResponse.json({ error: "Invalid section ID" }, { status: 400 });
		}

		const [section] = await db
			.select()
			.from(class_sections)
			.where(eq(class_sections.id, sectionId))
			.limit(1);

		if (!section) {
			return NextResponse.json({ error: "Section not found" }, { status: 404 });
		}

		return NextResponse.json({ class_section: section }, { status: 200 });
	} catch (error: any) {
		console.error("Fetch section error:", error);
		return NextResponse.json(
			{ error: error.message || "Failed to fetch section" },
			{ status: 500 },
		);
	}
}

// PATCH - Update class section
export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { userId } = await auth();
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Ensure user is super_admin
		await getOrCreateUser(userId);
		const role = await getUserRoleFromDB(userId);
		if (role !== "super_admin") {
			return NextResponse.json({ error: "Forbidden: Super admin only" }, { status: 403 });
		}

		const { id } = await params;
		const sectionId = parseInt(id);

		if (isNaN(sectionId)) {
			return NextResponse.json({ error: "Invalid section ID" }, { status: 400 });
		}

		// Check if section exists
		const [existing] = await db
			.select()
			.from(class_sections)
			.where(eq(class_sections.id, sectionId))
			.limit(1);

		if (!existing) {
			return NextResponse.json({ error: "Section not found" }, { status: 404 });
		}

		const body = await request.json();
		const { name, is_active } = body;

		// Build update object
		const updates: any = {
			updated_at: new Date(),
		};

		if (name !== undefined) {
			if (typeof name !== "string" || name.trim().length === 0) {
				return NextResponse.json({ error: "Section name cannot be empty" }, { status: 400 });
			}

			const normalizedName = name.trim().toUpperCase();

			// Check if another section has this name
			const [duplicate] = await db
				.select()
				.from(class_sections)
				.where(eq(class_sections.name, normalizedName))
				.limit(1);

			if (duplicate && duplicate.id !== sectionId) {
				return NextResponse.json(
					{ error: `Section name '${name}' is already taken` },
					{ status: 409 },
				);
			}

			updates.name = normalizedName;
		}

		if (is_active !== undefined) {
			updates.is_active = Boolean(is_active);
		}

		// Update section
		const [updatedSection] = await db
			.update(class_sections)
			.set(updates)
			.where(eq(class_sections.id, sectionId))
			.returning();

		return NextResponse.json(
			{ message: "Section updated successfully", class_section: updatedSection },
			{ status: 200 },
		);
	} catch (error: any) {
		console.error("Update section error:", error);
		return NextResponse.json(
			{ error: error.message || "Failed to update section" },
			{ status: 500 },
		);
	}
}

// DELETE - Soft delete section (deactivate)
export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { userId } = await auth();
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Ensure user is super_admin
		await getOrCreateUser(userId);
		const role = await getUserRoleFromDB(userId);
		if (role !== "super_admin") {
			return NextResponse.json({ error: "Forbidden: Super admin only" }, { status: 403 });
		}

		const { id } = await params;
		const sectionId = parseInt(id);

		if (isNaN(sectionId)) {
			return NextResponse.json({ error: "Invalid section ID" }, { status: 400 });
		}

		// Check if section exists
		const [existing] = await db
			.select()
			.from(class_sections)
			.where(eq(class_sections.id, sectionId))
			.limit(1);

		if (!existing) {
			return NextResponse.json({ error: "Section not found" }, { status: 404 });
		}

		// Check if any students are currently assigned
		const [studentCount] = await db
			.select()
			.from(students)
			.where(eq(students.class_section_id, sectionId))
			.limit(1);

		if (studentCount) {
			return NextResponse.json(
				{
					error: "Cannot delete section with assigned students",
					message: "Please reassign students before deleting this section",
				},
				{ status: 409 },
			);
		}

		// Soft delete by deactivating
		const [deletedSection] = await db
			.update(class_sections)
			.set({
				is_active: false,
				updated_at: new Date(),
			})
			.where(eq(class_sections.id, sectionId))
			.returning();

		return NextResponse.json(
			{ message: "Section deactivated successfully", class_section: deletedSection },
			{ status: 200 },
		);
	} catch (error: any) {
		console.error("Delete section error:", error);
		return NextResponse.json(
			{ error: error.message || "Failed to delete section" },
			{ status: 500 },
		);
	}
}
