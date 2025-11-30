/**
 * GET /api/superadmin/batches
 * POST /api/superadmin/batches
 * 
 * Manage batches master data
 * SuperAdmin-only endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { batches } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";

// GET - List all batches
export async function GET(request: NextRequest) {
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

		const { searchParams } = new URL(request.url);
		const activeOnly = searchParams.get("active") === "true";

		const query = db
			.select({
		id: batches.id,
		batch_year: batches.batch_year,
		is_active: batches.is_active,
		created_at: batches.created_at,
			})
			.from(batches);

	const batchList = activeOnly
		? await query.where(eq(batches.is_active, true)).orderBy(batches.batch_year)
		: await query.orderBy(batches.batch_year);

		return NextResponse.json({ batches: batchList }, { status: 200 });
	} catch (error: unknown) {
		console.error("Fetch batches error:", error);
		const errorMessage = error instanceof Error ? error.message : "Failed to fetch batches";
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 },
		);
	}
}

// POST - Create new batch
export async function POST(request: NextRequest) {
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

		const body = await request.json();
		const { batch_year } = body;

		// Validate required fields
		if (!batch_year || isNaN(parseInt(batch_year))) {
			return NextResponse.json({ error: "Valid batch year is required" }, { status: 400 });
		}

		const year = parseInt(batch_year);

		if (year < 2000 || year > 2100) {
			return NextResponse.json(
				{ error: "Batch year must be between 2000 and 2100" },
				{ status: 400 },
			);
		}

		// Check if batch with same year already exists
		const [existing] = await db
			.select({
				id: batches.id,
				batch_year: batches.batch_year,
			})
			.from(batches)
			.where(eq(batches.batch_year, year))
			.limit(1);

		if (existing) {
			return NextResponse.json(
				{ error: `Batch ${year} already exists` },
				{ status: 409 },
			);
		}

		// Create batch
		const [newBatch] = await db
			.insert(batches)
			.values({
				batch_year: year,
				is_active: true,
			})
			.returning();

		return NextResponse.json(
			{ message: "Batch created successfully", batch: newBatch },
			{ status: 201 },
		);
	} catch (error: unknown) {
		console.error("Create batch error:", error);
		const errorMessage = error instanceof Error ? error.message : "Failed to create batch";
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 },
		);
	}
}
