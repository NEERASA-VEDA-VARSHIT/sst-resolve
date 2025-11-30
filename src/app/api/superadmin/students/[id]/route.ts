/**
 * /api/superadmin/students/[id]
 * 
 * GET - Fetch single student details
 * PATCH - Update student information  
 * DELETE - Hard delete student record (DANGEROUS)
 * 
 * SuperAdmin-only endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { students, users, tickets, hostels, batches, class_sections } from "@/db/schema";
import type { StudentInsert } from "@/db/inferred-types";
import { eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import { AdminUpdateStudentSchema } from "@/schemas/business/student";

/**
 * GET /api/superadmin/students/[id]
 * Get a single student's detailed information
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { userId } = await auth();
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const role = await getUserRoleFromDB(userId);
		if (role !== "super_admin") {
			return NextResponse.json({ error: "Forbidden: Super admin only" }, { status: 403 });
		}

		const { id } = await params;
		const studentId = parseInt(id);
		if (isNaN(studentId)) {
			return NextResponse.json({ error: "Invalid student ID" }, { status: 400 });
		}

		const [student] = await db
			.select({
				student_id: students.id,
				user_id: students.user_id,
				roll_no: students.roll_no,
				room_no: students.room_no,
				batch_year: batches.batch_year,
				department: students.department,
				hostel_id: students.hostel_id,
				batch_id: students.batch_id,
				class_section_id: students.class_section_id,
				email: users.email,
				full_name: users.full_name,
				phone: users.phone,
				hostel_name: hostels.name,
				section_name: class_sections.name,
			})
			.from(students)
			.innerJoin(users, eq(students.user_id, users.id))
			.leftJoin(hostels, eq(students.hostel_id, hostels.id))
			.leftJoin(batches, eq(students.batch_id, batches.id))
			.leftJoin(class_sections, eq(students.class_section_id, class_sections.id))
			.where(eq(students.id, studentId))
			.limit(1);

		if (!student) {
			return NextResponse.json({ error: "Student not found" }, { status: 404 });
		}

		return NextResponse.json({ student });
	} catch (error) {
		console.error("Error fetching student:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * PATCH /api/superadmin/students/[id]
 * Update student information
 */
export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { userId } = await auth();
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const role = await getUserRoleFromDB(userId);
		if (role !== "super_admin") {
			return NextResponse.json({ error: "Forbidden: Super admin only" }, { status: 403 });
		}

		const { id } = await params;
		const studentId = parseInt(id);
		if (isNaN(studentId)) {
			return NextResponse.json({ error: "Invalid student ID" }, { status: 400 });
		}

		const body = await request.json();
		const parsed = AdminUpdateStudentSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid request data", details: parsed.error.format() },
				{ status: 400 }
			);
		}

		const updateData = parsed.data;

		const [existingStudent] = await db
			.select()
			.from(students)
			.where(eq(students.id, studentId))
			.limit(1);

		if (!existingStudent) {
			return NextResponse.json({ error: "Student not found" }, { status: 404 });
		}

		const updatedStudent = await db.transaction(async (tx) => {
			// Use Partial<StudentInsert> for type-safe updates
			const studentUpdate: Partial<StudentInsert> = {
				...updateData,
				updated_at: new Date(),
			};

			// Remove fields that go to users table
			delete (studentUpdate as Record<string, unknown>).full_name;
			delete (studentUpdate as Record<string, unknown>).phone;

			const [updated] = await tx
				.update(students)
				.set(studentUpdate)
				.where(eq(students.id, studentId))
				.returning();

			// Update users table if name or phone changed
			const userUpdate: Record<string, unknown> = {};
			if (updateData.full_name) {
				userUpdate.full_name = updateData.full_name.trim() || null;
			}
			if (updateData.phone !== undefined) userUpdate.phone = updateData.phone;

			if (Object.keys(userUpdate).length > 0) {
				userUpdate.updated_at = new Date();
				await tx
					.update(users)
					.set(userUpdate)
					.where(eq(users.id, existingStudent.user_id));
			}

			return updated;
		});

		return NextResponse.json({
			success: true,
			message: "Student updated successfully",
			student: updatedStudent,
		});
	} catch (error) {
		console.error("Error updating student:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * DELETE /api/superadmin/students/[id]
 * Hard delete student record (DANGEROUS - use with caution)
 */
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
		const studentId = parseInt(id);
		if (isNaN(studentId) || studentId <= 0) {
			return NextResponse.json({ error: "Invalid student ID" }, { status: 400 });
		}

		const [student] = await db
			.select()
			.from(students)
			.where(eq(students.id, studentId))
			.limit(1);

		if (!student) {
			return NextResponse.json({ error: "Student not found" }, { status: 404 });
		}

		const studentTickets = await db
			.select({ id: tickets.id })
			.from(tickets)
			.where(eq(tickets.created_by, student.user_id))
			.limit(1);

		if (studentTickets.length > 0) {
			return NextResponse.json({
				error: "Cannot delete student with ticket history. Use deactivate endpoint instead.",
				suggestion: "PATCH /api/superadmin/students/deactivate with student_ids: [" + studentId + "]"
			}, { status: 409 });
		}

		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.id, student.user_id))
			.limit(1);

		const neverLoggedIn = user?.external_id?.startsWith("pending_");

		await db
			.delete(students)
			.where(eq(students.id, studentId));

		if (neverLoggedIn && user) {
			await db
				.delete(users)
				.where(eq(users.id, user.id));
		}

		return NextResponse.json({
			success: true,
			message: "Student deleted successfully",
			deleted: {
				student_id: studentId,
				roll_no: student.roll_no,
				user_deleted: neverLoggedIn,
			},
			warning: neverLoggedIn ? "User record also deleted (never logged in)" : "User record preserved"
		}, { status: 200 });

	} catch (error: unknown) {
		console.error("Delete student error:", error);

		if (error && typeof error === 'object' && ('message' in error || 'code' in error)) {
			const errorMessage = 'message' in error && typeof error.message === 'string' ? error.message : '';
			const errorCode = 'code' in error ? error.code : null;
			
			if (errorMessage.includes("foreign key") || errorCode === "23503") {
				return NextResponse.json({
					error: "Cannot delete student with related records (tickets, assignments, etc.). Use deactivate instead.",
					code: "FOREIGN_KEY_VIOLATION"
				}, { status: 409 });
			}
		}

		const errorMessage = error instanceof Error ? error.message : "Failed to delete student";
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 },
		);
	}
}
