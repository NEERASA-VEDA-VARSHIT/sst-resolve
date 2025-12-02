/**
 * POST /api/superadmin/students/create
 * 
 * Create a single student
 * SuperAdmin-only endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, students, hostels, batches, class_sections, roles } from "@/db/schema";
import type { UserInsert, StudentInsert } from "@/db/inferred-types";
import { eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";

function cleanFullName(name: string): string {
	if (!name) return name;
	return name
		.trim()
		.split(/\s+/)
		.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
}

function cleanEmail(email: string): string {
	return email.trim().toLowerCase();
}

function cleanMobile(mobile: string): string {
	return mobile.replace(/\D/g, "");
}

export async function POST(request: NextRequest) {
	try {
		const { userId } = await auth();
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const role = await getUserRoleFromDB(userId);
		if (role !== "super_admin") {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const body = await request.json();
		const {
			email,
			full_name,
			hostel_id,
			room_number,
			class_section_id,
			batch_id,
			mobile,
			blood_group,
		} = body;

		// Validate required fields
		if (!email || !full_name || !mobile || !room_number || 
			!hostel_id || !class_section_id || !batch_id || !blood_group) {
			return NextResponse.json(
				{ error: "All fields are required: email, full name, mobile, room number, hostel, class section, batch, and blood group" },
				{ status: 400 }
			);
		}

		// Validate email format
		const cleanedEmail = cleanEmail(email);
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
			return NextResponse.json(
				{ error: "Invalid email format" },
				{ status: 400 }
			);
		}

		// Validate mobile (required)
		const cleanedMobile = cleanMobile(mobile);
		if (cleanedMobile.length !== 10) {
			return NextResponse.json(
				{ error: "Mobile number must be 10 digits" },
				{ status: 400 }
			);
		}

		// Validate master data references (all required)
		const [hostel] = await db
			.select()
			.from(hostels)
			.where(eq(hostels.id, hostel_id))
			.limit(1);
		if (!hostel || !hostel.is_active) {
			return NextResponse.json(
				{ error: "Invalid or inactive hostel" },
				{ status: 400 }
			);
		}

		const [section] = await db
			.select()
			.from(class_sections)
			.where(eq(class_sections.id, class_section_id))
			.limit(1);
		if (!section || !section.is_active) {
			return NextResponse.json(
				{ error: "Invalid or inactive class section" },
				{ status: 400 }
			);
		}

		const [batch] = await db
			.select()
			.from(batches)
			.where(eq(batches.id, batch_id))
			.limit(1);
		if (!batch || !batch.is_active) {
			return NextResponse.json(
				{ error: "Invalid or inactive batch" },
				{ status: 400 }
			);
		}

		// Normalize and validate blood group
		const normalizedBloodGroup = String(blood_group).trim().toUpperCase();
		const allowedBloodGroups = new Set([
			"A+",
			"A-",
			"B+",
			"B-",
			"O+",
			"O-",
			"AB+",
			"AB-",
		]);
		if (!allowedBloodGroups.has(normalizedBloodGroup)) {
			return NextResponse.json(
				{ error: "Blood group must be one of A+, A-, B+, B-, O+, O-, AB+, AB-" },
				{ status: 400 }
			);
		}

		// Derive a technical roll_no so DB constraints are satisfied.
		// Business flows no longer use roll numbers, so we just need a stable,
		// short identifier that fits within varchar(32).
		const generatedRollNo = cleanedEmail.slice(0, 32);

		// Get student role
		const [studentRole] = await db
			.select({ id: roles.id })
			.from(roles)
			.where(eq(roles.name, "student"))
			.limit(1);

		if (!studentRole) {
			return NextResponse.json(
				{ error: "Student role not found in database" },
				{ status: 500 }
			);
		}

		// Prepare data
		const cleanedName = cleanFullName(full_name);

		// Check if user already exists
		const [existingUser] = await db
			.select()
			.from(users)
			.where(eq(users.email, cleanedEmail))
			.limit(1);

		// Create or update user and student in a transaction
		const result = await db.transaction(async (tx) => {
			let targetUser = existingUser;

			// If user doesn't exist, create it
			if (!targetUser) {
				const userData: UserInsert = {
					auth_provider: "manual",
					external_id: `pending_${cleanedEmail}`, // Temporary, will be updated on first login
					email: cleanedEmail,
					full_name: cleanedName,
					phone: cleanedMobile,
					role_id: studentRole.id,
				};
				const [newUser] = await tx
					.insert(users)
					.values(userData)
					.returning();
				targetUser = newUser;
			} else {
				// User exists - update their info (name, phone) but keep their external_id
				const userUpdate: Partial<UserInsert> = {
					full_name: cleanedName,
					phone: cleanedMobile,
					role_id: studentRole.id, // Ensure they have student role
					updated_at: new Date(),
				};
				await tx
					.update(users)
					.set(userUpdate)
					.where(eq(users.id, targetUser.id));
			}

			// Check if student record already exists for this user
			const [existingStudent] = await tx
				.select()
				.from(students)
				.where(eq(students.user_id, targetUser.id))
				.limit(1);

			let studentRecord;
			let wasStudentCreated = false;
			if (existingStudent) {
				// Update existing student record
				const studentUpdate: Partial<StudentInsert> & { roll_no?: string | null } = {
					// Keep existing roll_no if present; otherwise backfill with generatedRollNo
					roll_no: (existingStudent as { roll_no?: string | null })?.roll_no ?? generatedRollNo,
					room_no: room_number.trim(),
					hostel_id: hostel_id,
					class_section_id: class_section_id,
					batch_id: batch_id,
					blood_group: normalizedBloodGroup,
					updated_at: new Date(),
				};
				const [updatedStudent] = await tx
					.update(students)
					.set(studentUpdate)
					.where(eq(students.id, existingStudent.id))
					.returning();
				studentRecord = updatedStudent;
				wasStudentCreated = false;
			} else {
				// Create new student record
				const studentData: StudentInsert & { roll_no?: string } = {
					user_id: targetUser.id,
					roll_no: generatedRollNo,
					room_no: room_number.trim(),
					hostel_id: hostel_id,
					class_section_id: class_section_id,
					batch_id: batch_id,
					blood_group: normalizedBloodGroup,
				};
				const [newStudent] = await tx
					.insert(students)
					.values(studentData)
					.returning();
				studentRecord = newStudent;
				wasStudentCreated = true;
			}

			return { user: targetUser, student: studentRecord, wasStudentCreated };
		});

		return NextResponse.json(
			{
				success: true,
				message: result.wasStudentCreated 
					? "Student created successfully" 
					: "Student profile updated successfully",
				student: {
					id: result.student.id,
					email: result.user.email,
					full_name: cleanedName,
				},
			},
			{ status: result.wasStudentCreated ? 201 : 200 }
		);
	} catch (error: unknown) {
		console.error("Create student error:", error);
		
		// Handle PostgreSQL duplicate key errors specifically
		if (error instanceof Error && 'code' in error && error.code === '23505') {
			// Check if it's an email duplicate
			if (error.message.includes('email') || error.message.includes('users_email_unique')) {
				return NextResponse.json(
					{ error: "A user with this email already exists. Please use a different email address." },
					{ status: 409 } // 409 Conflict is more appropriate for duplicate resources
				);
			}
			// Check if it's a roll number duplicate
			if (error.message.includes('roll_no') || error.message.includes('students_roll_no')) {
				return NextResponse.json(
					{ error: "A student with this roll number already exists. Please use a different roll number." },
					{ status: 409 }
				);
			}
			// Generic duplicate key error
			return NextResponse.json(
				{ error: "This record already exists in the database. Please check for duplicates." },
				{ status: 409 }
			);
		}
		
		const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 }
		);
	}
}

