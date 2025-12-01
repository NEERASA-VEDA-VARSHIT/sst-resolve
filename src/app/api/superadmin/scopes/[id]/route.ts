/**
 * GET /api/superadmin/scopes/[id]
 * PATCH /api/superadmin/scopes/[id]
 * DELETE /api/superadmin/scopes/[id]
 * 
 * Manage individual scope
 * SuperAdmin-only endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { scopes, categories } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";

// GET - Get single scope by ID
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { userId } = await auth();
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		await getOrCreateUser(userId);
		const role = await getUserRoleFromDB(userId);
		if (role !== "super_admin") {
			return NextResponse.json({ error: "Forbidden: Super admin only" }, { status: 403 });
		}

		const { id } = await params;
		const scopeId = parseInt(id);
		if (isNaN(scopeId) || scopeId <= 0) {
			return NextResponse.json({ error: "Invalid scope ID" }, { status: 400 });
		}

		const [scope] = await db
			.select({
				id: scopes.id,
				name: scopes.name,
				domain_id: scopes.domain_id,
				student_field_key: scopes.student_field_key,
				is_active: scopes.is_active,
				created_at: scopes.created_at,
				updated_at: scopes.updated_at,
			})
			.from(scopes)
			.where(eq(scopes.id, scopeId))
			.limit(1);

		if (!scope) {
			return NextResponse.json({ error: "Scope not found" }, { status: 404 });
		}

		return NextResponse.json({ scope }, { status: 200 });
	} catch (error: unknown) {
		console.error("Get scope error:", error);
		const errorMessage = error instanceof Error ? error.message : "Failed to fetch scope";
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 },
		);
	}
}

// PATCH - Update scope
export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { userId } = await auth();
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		await getOrCreateUser(userId);
		const role = await getUserRoleFromDB(userId);
		if (role !== "super_admin") {
			return NextResponse.json({ error: "Forbidden: Super admin only" }, { status: 403 });
		}

		const { id } = await params;
		const scopeId = parseInt(id);
		if (isNaN(scopeId) || scopeId <= 0) {
			return NextResponse.json({ error: "Invalid scope ID" }, { status: 400 });
		}

		// Check if scope exists
		const [existing] = await db
			.select()
			.from(scopes)
			.where(eq(scopes.id, scopeId))
			.limit(1);

		if (!existing) {
			return NextResponse.json({ error: "Scope not found" }, { status: 404 });
		}

		const body = await request.json();
		const { name, domain_id, student_field_key, is_active } = body;

		const updates: {
			name?: string;
			domain_id?: number;
			student_field_key?: string | null;
			is_active?: boolean;
			updated_at?: Date;
		} = { updated_at: new Date() };

		if (name !== undefined) {
			if (typeof name !== "string" || name.trim().length === 0) {
				return NextResponse.json({ error: "Scope name cannot be empty" }, { status: 400 });
			}
			updates.name = name.trim();

			// Check for duplicate name in the same domain (if domain_id is being updated, use new domain_id, otherwise existing)
			const checkDomainId = domain_id !== undefined ? domain_id : existing.domain_id;
			const [duplicate] = await db
				.select({ id: scopes.id })
				.from(scopes)
				.where(and(eq(scopes.domain_id, checkDomainId), eq(scopes.name, name.trim())))
				.limit(1);

			if (duplicate && duplicate.id !== scopeId) {
				return NextResponse.json(
					{ error: `Scope '${name}' already exists in this domain` },
					{ status: 409 },
				);
			}
		}

		if (domain_id !== undefined) {
			if (typeof domain_id !== "number") {
				return NextResponse.json({ error: "Invalid domain_id" }, { status: 400 });
			}
			updates.domain_id = domain_id;
		}

		if (student_field_key !== undefined) {
			const validStudentFieldKeys = ["hostel_id", "class_section_id", "batch_id", null];
			if (student_field_key !== null && typeof student_field_key !== "string") {
				return NextResponse.json(
					{ error: "student_field_key must be a string or null" },
					{ status: 400 },
				);
			}
			if (student_field_key !== null && !validStudentFieldKeys.includes(student_field_key)) {
				return NextResponse.json(
					{ error: "student_field_key must be one of: hostel_id, class_section_id, batch_id, or null" },
					{ status: 400 },
				);
			}
			updates.student_field_key = student_field_key === null ? null : student_field_key.trim();
		}

		if (is_active !== undefined) {
			updates.is_active = Boolean(is_active);
		}

		const [updatedScope] = await db
			.update(scopes)
			.set(updates)
			.where(eq(scopes.id, scopeId))
			.returning();

		return NextResponse.json(
			{ message: "Scope updated successfully", scope: updatedScope },
			{ status: 200 },
		);
	} catch (error: unknown) {
		console.error("Update scope error:", error);
		const errorMessage = error instanceof Error ? error.message : "Failed to update scope";
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 },
		);
	}
}

// DELETE - Soft delete/deactivate scope
export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { userId } = await auth();
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		await getOrCreateUser(userId);
		const role = await getUserRoleFromDB(userId);
		if (role !== "super_admin") {
			return NextResponse.json({ error: "Forbidden: Super admin only" }, { status: 403 });
		}

		const { id } = await params;
		const scopeId = parseInt(id);
		if (isNaN(scopeId) || scopeId <= 0) {
			return NextResponse.json({ error: "Invalid scope ID" }, { status: 400 });
		}

		// Check if scope exists
		const [existing] = await db
			.select()
			.from(scopes)
			.where(eq(scopes.id, scopeId))
			.limit(1);

		if (!existing) {
			return NextResponse.json({ error: "Scope not found" }, { status: 404 });
		}

		// Check if scope is used by any categories
		const [categoryCount] = await db
			.select()
			.from(categories)
			.where(eq(categories.scope_id, scopeId))
			.limit(1);

		if (categoryCount) {
			return NextResponse.json(
				{
					error: "Cannot delete scope with assigned categories",
					message: "Please reassign or delete categories before deleting this scope",
				},
				{ status: 409 },
			);
		}

		// Soft delete
		const [deletedScope] = await db
			.update(scopes)
			.set({ is_active: false, updated_at: new Date() })
			.where(eq(scopes.id, scopeId))
			.returning();

		return NextResponse.json(
			{ message: "Scope deactivated successfully", scope: deletedScope },
			{ status: 200 },
		);
	} catch (error: unknown) {
		console.error("Delete scope error:", error);
		const errorMessage = error instanceof Error ? error.message : "Failed to delete scope";
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 },
		);
	}
}
