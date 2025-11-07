import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db, students } from "@/db";
import { eq } from "drizzle-orm";
import { UpdateStudentProfileSchema } from "@/schema/student.schema";

// GET - Get current user's student profile
export async function GET(request: NextRequest) {
	try {
		const { userId } = await auth();
		
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Get userNumber from Clerk publicMetadata
		const client = await clerkClient();
		const user = await client.users.getUser(userId);
		const userNumber = (user.publicMetadata as any)?.userNumber as string | undefined;

		if (!userNumber) {
			return NextResponse.json({ 
				error: "User number not linked", 
				needsLink: true 
			}, { status: 404 });
		}

		// Get student profile
		const [student] = await db
			.select()
			.from(students)
			.where(eq(students.userNumber, userNumber))
			.limit(1);

		if (!student) {
			return NextResponse.json({ 
				error: "Student profile not found",
				needsLink: true,
				userNumber 
			}, { status: 404 });
		}

		return NextResponse.json(student);
	} catch (error) {
		console.error("Error fetching profile:", error);
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}

// PATCH - Update current user's student profile
export async function PATCH(request: NextRequest) {
	try {
		const { userId } = await auth();
		
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const { userNumber, ...profileData } = body;

		// Validate profile data using Zod schema (userNumber handled separately for linking)
		const validationResult = UpdateStudentProfileSchema.safeParse(profileData);
		if (!validationResult.success) {
			return NextResponse.json(
				{ error: "Validation failed", details: validationResult.error.errors },
				{ status: 400 }
			);
		}

		const { fullName, email, roomNumber, mobile, hostel } = validationResult.data;

		// Get userNumber from Clerk publicMetadata or from request body
		const client = await clerkClient();
		const user = await client.users.getUser(userId);
		let currentUserNumber = (user.publicMetadata as any)?.userNumber as string | undefined;

		// If userNumber provided in body, link it to Clerk user (validate if provided)
		if (userNumber) {
			if (typeof userNumber !== "string" || userNumber.trim().length === 0) {
				return NextResponse.json({ error: "Invalid user number" }, { status: 400 });
			}
			if (userNumber !== currentUserNumber) {
				await client.users.updateUser(userId, {
					publicMetadata: {
						...user.publicMetadata,
						userNumber: userNumber.trim(),
					},
				});
				currentUserNumber = userNumber.trim();
			}
		}

		if (!currentUserNumber) {
			return NextResponse.json({ 
				error: "User number not linked. Please provide userNumber in request." 
			}, { status: 400 });
		}

		// Prepare update data
		const updateData: any = {
			updatedAt: new Date(),
		};

		if (fullName !== undefined) updateData.fullName = fullName;
		if (email !== undefined) updateData.email = email;
		if (roomNumber !== undefined) updateData.roomNumber = roomNumber;
		if (mobile !== undefined) updateData.mobile = mobile;
		if (hostel !== undefined) updateData.hostel = hostel;

		// Update or insert student profile
		const [updatedStudent] = await db
			.insert(students)
			.values({
				userNumber: currentUserNumber,
				...updateData,
			})
			.onConflictDoUpdate({
				target: students.userNumber,
				set: updateData,
			})
			.returning();

		return NextResponse.json(updatedStudent);
	} catch (error) {
		console.error("Error updating profile:", error);
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}

