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
import { eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";

function splitFullName(name: string): { first_name: string; last_name: string } {
	if (!name) return { first_name: "", last_name: "" };
	const parts = name.trim().split(/\s+/);
	if (parts.length === 0) return { first_name: "", last_name: "" };
	if (parts.length === 1) return { first_name: parts[0], last_name: "" };
	const first_name = parts[0];
	const last_name = parts.slice(1).join(" ");
	return { first_name, last_name };
}

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
			user_number,
			hostel_id,
			room_number,
			class_section_id,
			batch_id,
			mobile,
			department,
		} = body;

		// Validate required fields
		if (!email || !full_name || !user_number) {
			return NextResponse.json(
				{ error: "Email, full name, and user number are required" },
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

		// Validate mobile if provided
		const cleanedMobile = mobile ? cleanMobile(mobile) : null;
		if (cleanedMobile && cleanedMobile.length !== 10) {
			return NextResponse.json(
				{ error: "Mobile number must be 10 digits" },
				{ status: 400 }
			);
		}

		// Validate master data references if provided
		if (hostel_id) {
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
		}

		if (class_section_id) {
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
		}

		if (batch_id) {
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
		}

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
		const nameParts = splitFullName(cleanFullName(full_name));
		const cleanedName = cleanFullName(full_name);

		// Check if user already exists
		const [existingUser] = await db
			.select()
			.from(users)
			.where(eq(users.email, cleanedEmail))
			.limit(1);

		// Check if student with this roll number already exists (and is linked to a different user)
		const [existingStudentByRoll] = await db
			.select({
				id: students.id,
				user_id: students.user_id,
			})
			.from(students)
			.where(eq(students.roll_no, user_number.trim()))
			.limit(1);

		// If roll number exists and is linked to a different user, that's an error
		if (existingStudentByRoll && existingUser && existingStudentByRoll.user_id !== existingUser.id) {
			return NextResponse.json(
				{ error: "A student with this roll number already exists and is linked to a different user" },
				{ status: 400 }
			);
		}

		// If roll number exists but no user exists, that's also an error (data inconsistency)
		if (existingStudentByRoll && !existingUser) {
			return NextResponse.json(
				{ error: "A student with this roll number already exists. Please contact support." },
				{ status: 400 }
			);
		}

		// Create or update user and student in a transaction
		const result = await db.transaction(async (tx) => {
			let targetUser = existingUser;

			// If user doesn't exist, create it
			if (!targetUser) {
				const [newUser] = await tx
					.insert(users)
					.values({
						clerk_id: `pending_${cleanedEmail}`, // Temporary, will be updated on first login
						email: cleanedEmail,
						first_name: nameParts.first_name,
						last_name: nameParts.last_name,
						phone: cleanedMobile,
						role_id: studentRole.id,
					})
					.returning();
				targetUser = newUser;
			} else {
				// User exists - update their info (name, phone) but keep their clerk_id
				await tx
					.update(users)
					.set({
						first_name: nameParts.first_name,
						last_name: nameParts.last_name,
						phone: cleanedMobile || targetUser.phone,
						role_id: studentRole.id, // Ensure they have student role
						updated_at: new Date(),
					})
					.where(eq(users.id, targetUser.id));
			}

			// Get batch_year from batch_id if provided
			let batch_year: number | null = null;
			if (batch_id) {
				const [batch] = await tx
					.select({ batch_year: batches.batch_year })
					.from(batches)
					.where(eq(batches.id, batch_id))
					.limit(1);
				if (batch) {
					batch_year = batch.batch_year;
				}
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
				const [updatedStudent] = await tx
					.update(students)
					.set({
						roll_no: user_number.trim(),
						room_no: room_number?.trim() || null,
						hostel_id: hostel_id || null,
						class_section_id: class_section_id || null,
						batch_id: batch_id || null,
						batch_year: batch_year,
						department: department?.trim() || null,
						source: "manual", // Track that this was updated manually
						active: true,
						last_synced_at: new Date(),
						updated_at: new Date(),
					})
					.where(eq(students.id, existingStudent.id))
					.returning();
				studentRecord = updatedStudent;
				wasStudentCreated = false;
			} else {
				// Create new student record
				const [newStudent] = await tx
					.insert(students)
					.values({
						user_id: targetUser.id,
						roll_no: user_number.trim(),
						room_no: room_number?.trim() || null,
						hostel_id: hostel_id || null,
						class_section_id: class_section_id || null,
						batch_id: batch_id || null,
						batch_year: batch_year,
						department: department?.trim() || null,
						source: "manual", // Track that this was created manually
						active: true,
						last_synced_at: new Date(),
					})
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
					roll_no: result.student.roll_no,
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

