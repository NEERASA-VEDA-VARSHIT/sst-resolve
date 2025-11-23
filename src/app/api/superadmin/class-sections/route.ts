/**
 * GET /api/superadmin/class-sections
 * POST /api/superadmin/class-sections
 * 
 * Manage class sections master data
 * SuperAdmin-only endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { class_sections } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";

// GET - List all class sections
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

	const query = db.select({
		id: class_sections.id,
		name: class_sections.name,
		is_active: class_sections.is_active,
		created_at: class_sections.created_at,
		updated_at: class_sections.updated_at,
	}).from(class_sections);

	const sectionList = activeOnly
		? await query.where(eq(class_sections.is_active, true)).orderBy(class_sections.name)
		: await query.orderBy(class_sections.name);

		return NextResponse.json({ class_sections: sectionList }, { status: 200 });
	} catch (error: unknown) {
		console.error("Fetch class sections error:", error);
		const errorMessage = error instanceof Error ? error.message : "Failed to fetch class sections";
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 },
		);
	}
}

// POST - Create new class section
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
		const { name } = body;

		// Validate required fields
		if (!name || typeof name !== "string" || name.trim().length === 0) {
			return NextResponse.json({ error: "Section name is required" }, { status: 400 });
		}

		// Check if section with same name already exists
		const [existing] = await db
			.select({
				id: class_sections.id,
				name: class_sections.name,
			})
			.from(class_sections)
			.where(eq(class_sections.name, name.trim().toUpperCase()))
			.limit(1);

		if (existing) {
			return NextResponse.json(
				{ error: `Section '${name}' already exists` },
				{ status: 409 },
			);
		}

		// Create section (store in uppercase for consistency)
		const [newSection] = await db
			.insert(class_sections)
			.values({
				name: name.trim().toUpperCase(),
				is_active: true,
			})
			.returning();

		return NextResponse.json(
			{ message: "Section created successfully", class_section: newSection },
			{ status: 201 },
		);
	} catch (error: unknown) {
		console.error("Create section error:", error);
		const errorMessage = error instanceof Error ? error.message : "Failed to create section";
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 },
		);
	}
}
