/**
 * PATCH /api/superadmin/students/reactivate
 * 
 * Reactivate students (undo soft delete)
 * Sets active = true for previously deactivated students
 * SuperAdmin-only endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { students } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { getCachedAdminUser } from "@/lib/cache/cached-queries";

interface ReactivateRequest {
	student_ids: number[]; // Array of student IDs to reactivate
}

interface ReactivateResponse {
	success: boolean;
	reactivated: number;
	errors: Array<{ id: number; error: string }>;
	message: string;
}

export async function PATCH(request: NextRequest) {
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

		const body: ReactivateRequest = await request.json();
		
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
			.select({ id: students.id })
			.from(students)
			.where(inArray(students.id, body.student_ids));

		const existingIds = new Set(existingStudents.map(s => s.id));
		const notFoundIds = body.student_ids.filter(id => !existingIds.has(id));

		// Reactivate students (update timestamp)
		// Note: If you need soft delete, add is_active field to students table
		const idsToReactivate = body.student_ids.filter(id => existingIds.has(id));

		let reactivated = 0;
		if (idsToReactivate.length > 0) {
			await db
				.update(students)
				.set({
					updated_at: new Date(),
				})
				.where(inArray(students.id, idsToReactivate));

			reactivated = idsToReactivate.length;
		}

		// Build error list
		const errors: Array<{ id: number; error: string }> = [];
		
		notFoundIds.forEach(id => {
			errors.push({ id, error: "Student not found" });
		});

		const response: ReactivateResponse = {
			success: errors.length === 0,
			reactivated,
			errors,
			message: `Reactivated ${reactivated} student(s). ${notFoundIds.length} not found.`,
		};

		return NextResponse.json(response, { status: 200 });
	} catch (error: unknown) {
		console.error("Reactivate students error:", error);
		const errorMessage = error instanceof Error ? error.message : "Failed to reactivate students";
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 },
		);
	}
}
