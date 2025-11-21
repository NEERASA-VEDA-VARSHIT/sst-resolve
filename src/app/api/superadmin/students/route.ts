/**
 * GET /api/superadmin/students
 * 
 * List all students with search and filter
 * SuperAdmin-only endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, students, hostels, batches, class_sections } from "@/db/schema";
import { eq, ilike, or, and, sql } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";

export async function GET(request: NextRequest) {
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

		const { searchParams } = new URL(request.url);
		const search = searchParams.get("search");
		const hostelFilter = searchParams.get("hostel");
		const batchYearFilter = searchParams.get("batch_year");
		const activeFilter = searchParams.get("active"); // 'true', 'false', or null (all)
		const page = parseInt(searchParams.get("page") || "1");
		const limit = parseInt(searchParams.get("limit") || "50");
		const offset = (page - 1) * limit;

		// Build query
		let whereConditions: any[] = [];

		if (search) {
			whereConditions.push(
				or(
					ilike(users.first_name, `%${search}%`),
					ilike(users.last_name, `%${search}%`),
					ilike(users.email, `%${search}%`),
					ilike(students.roll_no, `%${search}%`),
				),
			);
		}

		if (hostelFilter) {
			// Filter by hostel name (need to resolve from master table)
			whereConditions.push(ilike(hostels.name, hostelFilter));
		}

		if (batchYearFilter) {
			whereConditions.push(eq(students.batch_year, parseInt(batchYearFilter)));
		}

		// Active filter: 'true' = active only, 'false' = inactive only, null = all
		if (activeFilter === 'true') {
			whereConditions.push(eq(students.active, true));
		} else if (activeFilter === 'false') {
			whereConditions.push(eq(students.active, false));
		}

		// Fetch students with user info and master data
		const studentsData = await db
			.select({
				student_id: students.id,
				student_uid: students.student_uid,
				user_id: users.id,
				email: users.email,
				first_name: users.first_name,
				last_name: users.last_name,
				phone: users.phone,
				roll_no: students.roll_no,
				room_no: students.room_no,
				hostel: hostels.name, // Resolved from join
				class_section: class_sections.name, // Resolved from join
				batch_year: batches.batch_year, // Resolved from join
				batch_year_direct: students.batch_year, // Keep for fallback
				department: students.department,
				active: students.active,
				source: students.source,
				last_synced_at: students.last_synced_at,
				created_at: students.created_at,
				updated_at: students.updated_at,
			})
			.from(students)
			.innerJoin(users, eq(students.user_id, users.id))
			.leftJoin(hostels, eq(students.hostel_id, hostels.id))
			.leftJoin(class_sections, eq(students.class_section_id, class_sections.id))
			.leftJoin(batches, eq(students.batch_id, batches.id))
			.where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
			.orderBy(sql`${students.batch_year} DESC, ${students.roll_no} ASC`)
			.limit(limit)
			.offset(offset);

		// Get total count (with same joins for filters)
		const [countResult] = await db
			.select({ count: sql<number>`count(*)` })
			.from(students)
			.innerJoin(users, eq(students.user_id, users.id))
			.leftJoin(hostels, eq(students.hostel_id, hostels.id))
			.leftJoin(class_sections, eq(students.class_section_id, class_sections.id))
			.leftJoin(batches, eq(students.batch_id, batches.id))
			.where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

		const totalCount = Number(countResult.count);
		const totalPages = Math.ceil(totalCount / limit);

		return NextResponse.json(
			{
				students: studentsData,
				pagination: {
					page,
					limit,
					total: totalCount,
					totalPages,
				},
			},
			{ status: 200 },
		);
	} catch (error: any) {
		console.error("Fetch students error:", error);
		return NextResponse.json(
			{ error: error.message || "Failed to fetch students" },
			{ status: 500 },
		);
	}
}
