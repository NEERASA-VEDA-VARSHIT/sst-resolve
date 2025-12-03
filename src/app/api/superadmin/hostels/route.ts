/**
 * GET /api/superadmin/hostels
 * POST /api/superadmin/hostels
 * 
 * Manage hostels master data
 * SuperAdmin-only endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { hostels } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCachedAdminUser } from "@/lib/cache/cached-queries";

// GET - List all hostels
export async function GET(request: NextRequest) {
	try {
		const { userId } = await auth();
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Use cached function for better performance (request-scoped deduplication)
		const { role } = await getCachedAdminUser(userId);
		if (role !== "super_admin") {
			return NextResponse.json({ error: "Forbidden: Super admin only" }, { status: 403 });
		}

		const { searchParams } = new URL(request.url);
		const activeOnly = searchParams.get("active") === "true";

		const query = db
			.select({
				id: hostels.id,
				name: hostels.name,
				is_active: hostels.is_active,
				created_at: hostels.created_at,
			})
			.from(hostels);

		const hostelList = activeOnly
			? await query.where(eq(hostels.is_active, true)).orderBy(hostels.name)
			: await query.orderBy(hostels.name);

		return NextResponse.json({ hostels: hostelList }, { status: 200 });
	} catch (error: unknown) {
		console.error("Fetch hostels error:", error);
		const errorMessage = error instanceof Error ? error.message : "Failed to fetch hostels";
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 },
		);
	}
}

// POST - Create new hostel
export async function POST(request: NextRequest) {
	try {
		const { userId } = await auth();
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Use cached function for better performance (request-scoped deduplication)
		const { role } = await getCachedAdminUser(userId);
		if (role !== "super_admin") {
			return NextResponse.json({ error: "Forbidden: Super admin only" }, { status: 403 });
		}

		const body = await request.json();
		const { name } = body;

		// Validate required fields
		if (!name || typeof name !== "string" || name.trim().length === 0) {
			return NextResponse.json({ error: "Hostel name is required" }, { status: 400 });
		}

		// Check if hostel with same name already exists
		const [existing] = await db
			.select({
				id: hostels.id,
				name: hostels.name,
			})
			.from(hostels)
			.where(eq(hostels.name, name.trim()))
			.limit(1);

		if (existing) {
			return NextResponse.json(
				{ error: `Hostel '${name}' already exists` },
				{ status: 409 },
			);
		}

		// Create hostel
		const [newHostel] = await db
			.insert(hostels)
			.values({
				name: name.trim(),
				is_active: true,
			})
			.returning();

		return NextResponse.json(
			{ message: "Hostel created successfully", hostel: newHostel },
			{ status: 201 },
		);
	} catch (error: unknown) {
		console.error("Create hostel error:", error);
		const errorMessage = error instanceof Error ? error.message : "Failed to create hostel";
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 },
		);
	}
}
