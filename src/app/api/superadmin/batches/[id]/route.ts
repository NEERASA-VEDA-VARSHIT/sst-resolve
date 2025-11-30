/**
 * GET /api/superadmin/batches/[id]
 * PATCH /api/superadmin/batches/[id]
 * DELETE /api/superadmin/batches/[id]
 * 
 * Manage individual batch
 * SuperAdmin-only endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { batches, students } from "@/db/schema";
import type { BatchInsert } from "@/db/inferred-types";
import { eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";

// GET - Get single batch by ID
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
		const batchId = parseInt(id);

		if (isNaN(batchId)) {
			return NextResponse.json({ error: "Invalid batch ID" }, { status: 400 });
		}

		const [batch] = await db
			.select()
			.from(batches)
			.where(eq(batches.id, batchId))
			.limit(1);

		if (!batch) {
			return NextResponse.json({ error: "Batch not found" }, { status: 404 });
		}

		return NextResponse.json({ batch }, { status: 200 });
	} catch (error: unknown) {
		console.error("Fetch batch error:", error);
		const errorMessage = error instanceof Error ? error.message : "Failed to fetch batch";
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 },
		);
	}
}

// PATCH - Update batch
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
		const batchId = parseInt(id);

		if (isNaN(batchId)) {
			return NextResponse.json({ error: "Invalid batch ID" }, { status: 400 });
		}

		// Check if batch exists
		const [existing] = await db
			.select()
			.from(batches)
			.where(eq(batches.id, batchId))
			.limit(1);

		if (!existing) {
			return NextResponse.json({ error: "Batch not found" }, { status: 404 });
		}

		const body = await request.json();
		const { batch_year, is_active } = body;

		// Build update object
		const updates: Partial<BatchInsert> = {};

		if (batch_year !== undefined) {
			const year = parseInt(batch_year);
			if (isNaN(year) || year < 2000 || year > 2100) {
				return NextResponse.json(
					{ error: "Batch year must be between 2000 and 2100" },
					{ status: 400 },
				);
			}

			// Check if another batch has this year
			const [duplicate] = await db
				.select()
				.from(batches)
				.where(eq(batches.batch_year, year))
				.limit(1);

			if (duplicate && duplicate.id !== batchId) {
				return NextResponse.json(
					{ error: `Batch year ${year} is already taken` },
					{ status: 409 },
				);
			}

			updates.batch_year = year;
		}

		if (is_active !== undefined) {
			updates.is_active = Boolean(is_active);
		}

		// Update batch
		const [updatedBatch] = await db
			.update(batches)
			.set(updates)
			.where(eq(batches.id, batchId))
			.returning();

		return NextResponse.json(
			{ message: "Batch updated successfully", batch: updatedBatch },
			{ status: 200 },
		);
	} catch (error: unknown) {
		console.error("Update batch error:", error);
		const errorMessage = error instanceof Error ? error.message : "Failed to update batch";
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 },
		);
	}
}

// DELETE - Soft delete batch (deactivate)
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
		const batchId = parseInt(id);

		if (isNaN(batchId)) {
			return NextResponse.json({ error: "Invalid batch ID" }, { status: 400 });
		}

		// Check if batch exists
		const [existing] = await db
			.select()
			.from(batches)
			.where(eq(batches.id, batchId))
			.limit(1);

		if (!existing) {
			return NextResponse.json({ error: "Batch not found" }, { status: 404 });
		}

		// Check if any students are currently assigned
		const [studentCount] = await db
			.select()
			.from(students)
			.where(eq(students.batch_id, batchId))
			.limit(1);

		if (studentCount) {
			return NextResponse.json(
				{
					error: "Cannot delete batch with assigned students",
					message: "This batch has students. Deactivate instead of deleting.",
				},
				{ status: 409 },
			);
		}

		// Soft delete by deactivating
		const [deletedBatch] = await db
			.update(batches)
			.set({
				is_active: false,
			})
			.where(eq(batches.id, batchId))
			.returning();

		return NextResponse.json(
			{ message: "Batch deactivated successfully", batch: deletedBatch },
			{ status: 200 },
		);
	} catch (error: unknown) {
		console.error("Delete batch error:", error);
		const errorMessage = error instanceof Error ? error.message : "Failed to delete batch";
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 },
		);
	}
}
