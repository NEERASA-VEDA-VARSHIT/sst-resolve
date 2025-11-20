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
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";

// GET - List all hostels
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

		let query = db.select().from(hostels);
		
		if (activeOnly) {
			query = query.where(eq(hostels.is_active, true)) as any;
		}

		const hostelList = await query.orderBy(hostels.name);

		return NextResponse.json({ hostels: hostelList }, { status: 200 });
	} catch (error: any) {
		console.error("Fetch hostels error:", error);
		return NextResponse.json(
			{ error: error.message || "Failed to fetch hostels" },
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

		// Ensure user is super_admin
		await getOrCreateUser(userId);
		const role = await getUserRoleFromDB(userId);
		if (role !== "super_admin") {
			return NextResponse.json({ error: "Forbidden: Super admin only" }, { status: 403 });
		}

		const body = await request.json();
		const { name, code, capacity } = body;

		// Validate required fields
		if (!name || typeof name !== "string" || name.trim().length === 0) {
			return NextResponse.json({ error: "Hostel name is required" }, { status: 400 });
		}

		// Check if hostel with same name already exists
		const [existing] = await db
			.select()
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
				code: code?.trim() || null,
				capacity: capacity ? parseInt(capacity) : null,
				is_active: true,
			})
			.returning();

		return NextResponse.json(
			{ message: "Hostel created successfully", hostel: newHostel },
			{ status: 201 },
		);
	} catch (error: any) {
		console.error("Create hostel error:", error);
		return NextResponse.json(
			{ error: error.message || "Failed to create hostel" },
			{ status: 500 },
		);
	}
}
