/**
 * GET /api/superadmin/domains/[id]
 * PATCH /api/superadmin/domains/[id]
 * DELETE /api/superadmin/domains/[id]
 * 
 * Manage individual domain
 * SuperAdmin-only endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { domains, categories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCachedAdminUser } from "@/lib/cache/cached-queries";

// GET - Get single domain by ID
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
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

		const { id } = await params;
		const domainId = parseInt(id);

		if (isNaN(domainId)) {
			return NextResponse.json({ error: "Invalid domain ID" }, { status: 400 });
		}

		const [domain] = await db
			.select()
			.from(domains)
			.where(eq(domains.id, domainId))
			.limit(1);

		if (!domain) {
			return NextResponse.json({ error: "Domain not found" }, { status: 404 });
		}

		return NextResponse.json({ domain }, { status: 200 });
	} catch (error: unknown) {
		console.error("Fetch domain error:", error);
		const errorMessage = error instanceof Error ? error.message : "Failed to fetch domain";
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 },
		);
	}
}

// PATCH - Update domain
export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
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

		const { id } = await params;
		const domainId = parseInt(id);

		if (isNaN(domainId)) {
			return NextResponse.json({ error: "Invalid domain ID" }, { status: 400 });
		}

		// Check if domain exists
		const [existing] = await db
			.select()
			.from(domains)
			.where(eq(domains.id, domainId))
			.limit(1);

		if (!existing) {
			return NextResponse.json({ error: "Domain not found" }, { status: 404 });
		}

		const body = await request.json();
		const { name, description, is_active } = body;

		// Build update object
		const updates: {
			name?: string;
			description?: string | null;
			is_active?: boolean;
			updated_at?: Date;
		} = {
			updated_at: new Date(),
		};

		if (name !== undefined) {
			if (typeof name !== "string" || name.trim().length === 0) {
				return NextResponse.json({ error: "Domain name cannot be empty" }, { status: 400 });
			}

			// Check if another domain has this name
			const [duplicate] = await db
				.select()
				.from(domains)
				.where(eq(domains.name, name.trim()))
				.limit(1);

			if (duplicate && duplicate.id !== domainId) {
				return NextResponse.json(
					{ error: `Domain name '${name}' is already taken` },
					{ status: 409 },
				);
			}

			updates.name = name.trim();
		}

		if (description !== undefined) {
			updates.description = description && typeof description === "string" ? description.trim() || null : null;
		}

		if (is_active !== undefined) {
			updates.is_active = Boolean(is_active);
		}

		// Update domain
		const [updatedDomain] = await db
			.update(domains)
			.set(updates)
			.where(eq(domains.id, domainId))
			.returning();

		return NextResponse.json(
			{ message: "Domain updated successfully", domain: updatedDomain },
			{ status: 200 },
		);
	} catch (error: unknown) {
		console.error("Update domain error:", error);
		const errorMessage = error instanceof Error ? error.message : "Failed to update domain";
		// Check for unique constraint violation
		if (error instanceof Error && (error.message.includes("unique") || error.message.includes("duplicate"))) {
			return NextResponse.json(
				{ error: "Domain name is already taken" },
				{ status: 409 },
			);
		}
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 },
		);
	}
}

// DELETE - Soft delete domain (deactivate)
export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
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

		const { id } = await params;
		const domainId = parseInt(id);

		if (isNaN(domainId)) {
			return NextResponse.json({ error: "Invalid domain ID" }, { status: 400 });
		}

		// Check if domain exists
		const [existing] = await db
			.select()
			.from(domains)
			.where(eq(domains.id, domainId))
			.limit(1);

		if (!existing) {
			return NextResponse.json({ error: "Domain not found" }, { status: 404 });
		}

		// Check if any categories are using this domain
		const [categoryCount] = await db
			.select()
			.from(categories)
			.where(eq(categories.domain_id, domainId))
			.limit(1);

		if (categoryCount) {
			return NextResponse.json(
				{
					error: "Cannot delete domain with assigned categories",
					message: "Please reassign or delete categories before deleting this domain",
				},
				{ status: 409 },
			);
		}

		// Soft delete by deactivating
		const [deletedDomain] = await db
			.update(domains)
			.set({
				is_active: false,
				updated_at: new Date(),
			})
			.where(eq(domains.id, domainId))
			.returning();

		return NextResponse.json(
			{ message: "Domain deactivated successfully", domain: deletedDomain },
			{ status: 200 },
		);
	} catch (error: unknown) {
		console.error("Delete domain error:", error);
		const errorMessage = error instanceof Error ? error.message : "Failed to delete domain";
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 },
		);
	}
}
