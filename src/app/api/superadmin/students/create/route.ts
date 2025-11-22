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

function capitalize(str: string): string {
	if (!str) return str;
	return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

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

		// Check if user already exists
		const [existingUser] = await db
			.select()
			.from(users)
			.where(eq(users.email, cleanedEmail))
			.limit(1);

		if (existingUser) {
			// Check if user has already signed up with Clerk (not just a pending user)
			if (existingUser.clerk_id && !existingUser.clerk_id.startsWith('pending_')) {
				return NextResponse.json(
					{ error: "A user with this email already exists and has signed up. Please use a different email address." },
					{ status: 409 }
				);
			}
			// User exists but is pending - we can still return an error to avoid duplicates
			return NextResponse.json(
				{ error: "A user with this email already exists. Please use a different email address." },
				{ status: 409 }
			);
		}

		// Check if roll number already exists
		const [existingStudentByRoll] = await db
			.select()
			.from(students)
			.where(eq(students.roll_no, user_number.trim()))
			.limit(1);

		if (existingStudentByRoll) {
			return NextResponse.json(
				{ error: "A student with this roll number already exists" },
				{ status: 400 }
			);
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

		// Create user and student in a transaction
		const result = await db.transaction(async (tx) => {
			// Create user
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

			// Create student
			const [newStudent] = await tx
				.insert(students)
				.values({
					user_id: newUser.id,
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

			return { user: newUser, student: newStudent };
		});

		return NextResponse.json(
			{
				success: true,
				message: "Student created successfully",
				student: {
					id: result.student.id,
					roll_no: result.student.roll_no,
					email: result.user.email,
					full_name: cleanedName,
				},
			},
			{ status: 201 }
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

