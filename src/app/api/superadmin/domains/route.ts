/**
 * GET /api/superadmin/domains
 * POST /api/superadmin/domains
 * 
 * Manage domains master data
 * SuperAdmin-only endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { domains } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCachedAdminUser } from "@/lib/cache/cached-queries";

// GET - List all domains
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
				id: domains.id,
				name: domains.name,
				description: domains.description,
				is_active: domains.is_active,
				created_at: domains.created_at,
				updated_at: domains.updated_at,
			})
			.from(domains);

		const domainList = activeOnly
			? await query.where(eq(domains.is_active, true)).orderBy(domains.name)
			: await query.orderBy(domains.name);

		return NextResponse.json({ domains: domainList }, { status: 200 });
	} catch (error: unknown) {
		console.error("Fetch domains error:", error);
		const errorMessage = error instanceof Error ? error.message : "Failed to fetch domains";
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 },
		);
	}
}

// POST - Create new domain
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
		const { name, description } = body;
		const domainName = name && typeof name === "string" ? name.trim() : "";

		// Validate required fields
		if (!domainName || domainName.length === 0) {
			return NextResponse.json({ error: "Domain name is required" }, { status: 400 });
		}

		// Check if domain with same name already exists
		const [existing] = await db
			.select({
				id: domains.id,
				name: domains.name,
			})
			.from(domains)
			.where(eq(domains.name, domainName))
			.limit(1);

		if (existing) {
			return NextResponse.json(
				{ error: `Domain '${domainName}' already exists` },
				{ status: 409 },
			);
		}

		// Create domain
		const [newDomain] = await db
			.insert(domains)
			.values({
				name: domainName,
				description: description && typeof description === "string" ? description.trim() || null : null,
				is_active: true,
			})
			.returning();

		return NextResponse.json(
			{ message: "Domain created successfully", domain: newDomain },
			{ status: 201 },
		);
	} catch (error: unknown) {
		console.error("Create domain error:", error);
		const errorMessage = error instanceof Error ? error.message : "Failed to create domain";
		// Check for unique constraint violation
		if (error instanceof Error && (error.message.includes("unique") || error.message.includes("duplicate"))) {
			return NextResponse.json(
				{ error: "Domain with this name already exists" },
				{ status: 409 },
			);
		}
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 },
		);
	}
}
