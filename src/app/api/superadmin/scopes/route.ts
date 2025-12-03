/**
 * GET /api/superadmin/scopes
 * POST /api/superadmin/scopes
 * 
 * Manage scopes master data
 * SuperAdmin-only endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { scopes } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCachedAdminUser } from "@/lib/cache/cached-queries";

// GET - List all scopes
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
		const domainId = searchParams.get("domain_id");
		const activeOnly = searchParams.get("active") === "true";

		const baseSelect = db
			.select({
				id: scopes.id,
				name: scopes.name,
				domain_id: scopes.domain_id,
				student_field_key: scopes.student_field_key,
				is_active: scopes.is_active,
				created_at: scopes.created_at,
				updated_at: scopes.updated_at,
			})
			.from(scopes);

		const filters = [];
		if (domainId) {
			const domainIdNum = parseInt(domainId);
			if (isNaN(domainIdNum)) {
				return NextResponse.json({ error: "Invalid domain_id" }, { status: 400 });
			}
			filters.push(eq(scopes.domain_id, domainIdNum));
		}
		if (activeOnly) {
			filters.push(eq(scopes.is_active, true));
		}

		const filteredQuery =
			filters.length === 0
				? baseSelect
				: filters.length === 1
					? baseSelect.where(filters[0])
					: baseSelect.where(and(...filters));

		const scopeList = await filteredQuery.orderBy(scopes.name);

		return NextResponse.json({ scopes: scopeList }, { status: 200 });
	} catch (error: unknown) {
		console.error("Fetch scopes error:", error);
		const errorMessage = error instanceof Error ? error.message : "Failed to fetch scopes";
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 },
		);
	}
}

// POST - Create new scope
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
		const { name, domain_id, student_field_key } = body;
		const scopeName = name && typeof name === "string" ? name.trim() : "";

		// Validate required fields
		if (!scopeName || scopeName.length === 0) {
			return NextResponse.json({ error: "Scope name is required" }, { status: 400 });
		}

		if (!domain_id || typeof domain_id !== "number") {
			return NextResponse.json({ error: "Domain ID is required" }, { status: 400 });
		}

		// Validate student_field_key if provided
		const validStudentFieldKeys = ["hostel_id", "class_section_id", "batch_id", null, undefined];
		if (student_field_key !== null && student_field_key !== undefined) {
			if (typeof student_field_key !== "string" || !validStudentFieldKeys.includes(student_field_key)) {
				return NextResponse.json(
					{ error: "student_field_key must be one of: hostel_id, class_section_id, batch_id, or null" },
					{ status: 400 },
				);
			}
		}

		// Check if scope with same name already exists in this domain
		const [existing] = await db
			.select({
				id: scopes.id,
				name: scopes.name,
			})
			.from(scopes)
			.where(and(eq(scopes.domain_id, domain_id), eq(scopes.name, scopeName)))
			.limit(1);

		if (existing) {
			return NextResponse.json(
				{ error: `Scope '${scopeName}' already exists in this domain` },
				{ status: 409 },
			);
		}

		// Create scope
		const [newScope] = await db
			.insert(scopes)
			.values({
				name: scopeName,
				domain_id: domain_id,
				student_field_key: student_field_key && typeof student_field_key === "string" ? student_field_key.trim() : null,
				is_active: true,
			})
			.returning();

		return NextResponse.json(
			{ message: "Scope created successfully", scope: newScope },
			{ status: 201 },
		);
	} catch (error: unknown) {
		console.error("Create scope error:", error);
		const errorMessage = error instanceof Error ? error.message : "Failed to create scope";
		// Check for unique constraint violation
		if (error instanceof Error && (error.message.includes("unique") || error.message.includes("duplicate"))) {
			return NextResponse.json(
				{ error: "Scope with this name already exists in this domain" },
				{ status: 409 },
			);
		}
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 },
		);
	}
}
