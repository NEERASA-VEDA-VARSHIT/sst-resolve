/**
 * PATCH /api/superadmin/students/deactivate
 * 
 * Deactivate students (soft delete)
 * Sets active = false instead of hard delete to preserve ticket references
 * SuperAdmin-only endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { students } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";

interface DeactivateRequest {
	student_ids: number[]; // Array of student IDs to deactivate
	reason?: string; // Optional: 'graduated' | 'expelled' | 'left' | 'duplicate' | 'wrong_data' | 'other'
}

interface DeactivateResponse {
	success: boolean;
	deactivated: number;
	errors: Array<{ id: number; error: string }>;
	message: string;
}

export async function PATCH(request: NextRequest) {
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

		const body: DeactivateRequest = await request.json();
		
		if (!body.student_ids || !Array.isArray(body.student_ids) || body.student_ids.length === 0) {
			return NextResponse.json({ 
				error: "student_ids array is required and must not be empty" 
			}, { status: 400 });
		}

		// Validate all IDs are numbers
		const invalidIds = body.student_ids.filter(id => typeof id !== 'number' || id <= 0);
		if (invalidIds.length > 0) {
			return NextResponse.json({ 
				error: "All student_ids must be positive numbers",
				invalid: invalidIds
			}, { status: 400 });
		}

		// Check which students exist
		const existingStudents = await db
			.select({ id: students.id, active: students.active })
			.from(students)
			.where(inArray(students.id, body.student_ids));

		const existingIds = new Set(existingStudents.map(s => s.id));
		const notFoundIds = body.student_ids.filter(id => !existingIds.has(id));
		const alreadyInactive = existingStudents.filter(s => !s.active).map(s => s.id);

		// Deactivate students (soft delete)
		const idsToDeactivate = body.student_ids.filter(
			id => existingIds.has(id) && !alreadyInactive.includes(id)
		);

		let deactivated = 0;
		if (idsToDeactivate.length > 0) {
			const result = await db
				.update(students)
				.set({
					active: false,
					updated_at: new Date(),
				})
				.where(inArray(students.id, idsToDeactivate));

			deactivated = idsToDeactivate.length;
		}

		// Build error list
		const errors: Array<{ id: number; error: string }> = [];
		
		notFoundIds.forEach(id => {
			errors.push({ id, error: "Student not found" });
		});
		
		alreadyInactive.forEach(id => {
			errors.push({ id, error: "Already inactive" });
		});

		const response: DeactivateResponse = {
			success: errors.length === 0,
			deactivated,
			errors,
			message: `Deactivated ${deactivated} student(s). ${alreadyInactive.length} already inactive. ${notFoundIds.length} not found.`,
		};

		return NextResponse.json(response, { status: 200 });
	} catch (error: any) {
		console.error("Deactivate students error:", error);
		return NextResponse.json(
			{ error: error.message || "Failed to deactivate students" },
			{ status: 500 },
		);
	}
}
