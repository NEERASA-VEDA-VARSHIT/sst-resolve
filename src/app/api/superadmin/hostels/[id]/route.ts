/**
 * GET /api/superadmin/hostels/[id]
 * PATCH /api/superadmin/hostels/[id]
 * DELETE /api/superadmin/hostels/[id]
 * 
 * Manage individual hostel
 * SuperAdmin-only endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { hostels, students } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";

// GET - Get single hostel by ID
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
		const hostelId = parseInt(id);

		if (isNaN(hostelId)) {
			return NextResponse.json({ error: "Invalid hostel ID" }, { status: 400 });
		}

		const [hostel] = await db
			.select()
			.from(hostels)
			.where(eq(hostels.id, hostelId))
			.limit(1);

		if (!hostel) {
			return NextResponse.json({ error: "Hostel not found" }, { status: 404 });
		}

		return NextResponse.json({ hostel }, { status: 200 });
	} catch (error: unknown) {
		console.error("Fetch hostel error:", error);
		const errorMessage = error instanceof Error ? error.message : "Failed to fetch hostel";
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 },
		);
	}
}

// PATCH - Update hostel
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
		const hostelId = parseInt(id);

		if (isNaN(hostelId)) {
			return NextResponse.json({ error: "Invalid hostel ID" }, { status: 400 });
		}

		// Check if hostel exists
		const [existing] = await db
			.select()
			.from(hostels)
			.where(eq(hostels.id, hostelId))
			.limit(1);

		if (!existing) {
			return NextResponse.json({ error: "Hostel not found" }, { status: 404 });
		}

		const body = await request.json();
		const { name, code, capacity, is_active } = body;

		// Build update object
		const updates: Record<string, unknown> = {
			updated_at: new Date(),
		};

		if (name !== undefined) {
			if (typeof name !== "string" || name.trim().length === 0) {
				return NextResponse.json({ error: "Hostel name cannot be empty" }, { status: 400 });
			}

			// Check if another hostel has this name
			const [duplicate] = await db
				.select()
				.from(hostels)
				.where(eq(hostels.name, name.trim()))
				.limit(1);

			if (duplicate && duplicate.id !== hostelId) {
				return NextResponse.json(
					{ error: `Hostel name '${name}' is already taken` },
					{ status: 409 },
				);
			}

			updates.name = name.trim();
		}

		if (code !== undefined) {
			updates.code = code?.trim() || null;
		}

		if (capacity !== undefined) {
			updates.capacity = capacity ? parseInt(capacity) : null;
		}

		if (is_active !== undefined) {
			updates.is_active = Boolean(is_active);
		}

		// Update hostel
		const [updatedHostel] = await db
			.update(hostels)
			.set(updates)
			.where(eq(hostels.id, hostelId))
			.returning();

		return NextResponse.json(
			{ message: "Hostel updated successfully", hostel: updatedHostel },
			{ status: 200 },
		);
	} catch (error: unknown) {
		console.error("Update hostel error:", error);
		const errorMessage = error instanceof Error ? error.message : "Failed to update hostel";
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 },
		);
	}
}

// DELETE - Soft delete hostel (deactivate)
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
		const hostelId = parseInt(id);

		if (isNaN(hostelId)) {
			return NextResponse.json({ error: "Invalid hostel ID" }, { status: 400 });
		}

		// Check if hostel exists
		const [existing] = await db
			.select()
			.from(hostels)
			.where(eq(hostels.id, hostelId))
			.limit(1);

		if (!existing) {
			return NextResponse.json({ error: "Hostel not found" }, { status: 404 });
		}

		// Check if any students are currently assigned
		const [studentCount] = await db
			.select()
			.from(students)
			.where(eq(students.hostel_id, hostelId))
			.limit(1);

		if (studentCount) {
			return NextResponse.json(
				{
					error: "Cannot delete hostel with assigned students",
					message: "Please reassign students before deleting this hostel",
				},
				{ status: 409 },
			);
		}

		// Soft delete by deactivating
		const [deletedHostel] = await db
			.update(hostels)
			.set({
				is_active: false,
				updated_at: new Date(),
			})
			.where(eq(hostels.id, hostelId))
			.returning();

		return NextResponse.json(
			{ message: "Hostel deactivated successfully", hostel: deletedHostel },
			{ status: 200 },
		);
	} catch (error: unknown) {
		console.error("Delete hostel error:", error);
		const errorMessage = error instanceof Error ? error.message : "Failed to delete hostel";
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 },
		);
	}
}
