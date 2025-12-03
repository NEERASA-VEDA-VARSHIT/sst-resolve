/**
 * GET /api/superadmin/students
 * 
 * List all students with search and filter
 * SuperAdmin-only endpoint
 *
 * Columns: name, email, hostel, room, section, batch, blood_group, phone
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, students, hostels, batches, class_sections } from "@/db/schema";
import { eq, ilike, or, and, sql, desc } from "drizzle-orm";
import { getCachedAdminUser } from "@/lib/cache/cached-queries";

export async function GET(request: NextRequest) {
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

		const { searchParams } = new URL(request.url);
		const search = searchParams.get("search");
		const hostelFilter = searchParams.get("hostel");
		const batchYearFilter = searchParams.get("batch_year");
		const page = parseInt(searchParams.get("page") || "1");
		const limit = parseInt(searchParams.get("limit") || "50");
		const offset = (page - 1) * limit;

		// Build query
		type WhereCondition = ReturnType<typeof sql> | ReturnType<typeof and> | ReturnType<typeof or>;
		const whereConditions: WhereCondition[] = [];

		if (search) {
			whereConditions.push(
				or(
					ilike(users.full_name, `%${search}%`),
					ilike(users.email, `%${search}%`),
				),
			);
		}

		if (hostelFilter) {
			// Filter by hostel name (need to resolve from master table)
			whereConditions.push(ilike(hostels.name, hostelFilter));
		}

		if (batchYearFilter) {
			whereConditions.push(eq(batches.batch_year, parseInt(batchYearFilter)));
		}

		// Fetch students with user info and master data
		const studentsData = await db
			.select({
				student_id: students.id,
				user_id: users.id,
				email: users.email,
				full_name: users.full_name,
				phone: users.phone,
				room_no: students.room_no,
				hostel: hostels.name, // Resolved from join
				class_section: class_sections.name, // Resolved from join
				batch_year: batches.batch_year, // Resolved from join
				blood_group: students.blood_group,
				created_at: students.created_at,
				updated_at: students.updated_at,
			})
			.from(students)
			.innerJoin(users, eq(students.user_id, users.id))
			.leftJoin(hostels, eq(students.hostel_id, hostels.id))
			.leftJoin(class_sections, eq(students.class_section_id, class_sections.id))
			.leftJoin(batches, eq(students.batch_id, batches.id))
			.where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
			.orderBy(sql`${batches.batch_year} DESC NULLS LAST, ${users.full_name} ASC`)
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

		// Fetch all available batches from database for filter dropdown
		const availableBatches = await db
			.select({
				batch_year: batches.batch_year,
			})
			.from(batches)
			.where(eq(batches.is_active, true))
			.orderBy(desc(batches.batch_year));

		// Fetch all available hostels for filter dropdown
		const availableHostels = await db
			.select({
				id: hostels.id,
				name: hostels.name,
			})
			.from(hostels)
			.where(eq(hostels.is_active, true))
			.orderBy(hostels.name);

		return NextResponse.json(
			{
				students: studentsData,
				batches: availableBatches, // Include batches for filter dropdown
				hostels: availableHostels, // Include hostels for filter dropdown
				pagination: {
					page,
					limit,
					total: totalCount,
					totalPages,
				},
			},
			{ status: 200 },
		);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Failed to fetch students";
		console.error("Fetch students error:", error);
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 },
		);
	}
}
