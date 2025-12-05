import { db, users, students, hostels, batches, class_sections } from "@/db";
import { eq, ilike, or, and, sql, desc } from "drizzle-orm";
import { StudentsManagement } from "@/components/admin/students";

// Use ISR - revalidate every 30 seconds
export const revalidate = 30;

export default async function SuperAdminStudentsPage({
	searchParams,
}: {
	searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
	const resolvedSearchParams = searchParams ? await searchParams : {};
	
	const search = typeof resolvedSearchParams.search === "string" ? resolvedSearchParams.search : "";
	const hostelFilter = typeof resolvedSearchParams.hostel === "string" ? resolvedSearchParams.hostel : "";
	const batchYearFilter = typeof resolvedSearchParams.batch_year === "string" ? resolvedSearchParams.batch_year : "";
	const page = parseInt(typeof resolvedSearchParams.page === "string" ? resolvedSearchParams.page : "1");
	const limit = 50;
	const offset = (page - 1) * limit;

	// Build where conditions
	const whereConditions: ReturnType<typeof and>[] = [];

	if (search) {
		whereConditions.push(
			or(
				ilike(users.full_name, `%${search}%`),
				ilike(users.email, `%${search}%`),
			)!
		);
	}

	if (hostelFilter) {
		whereConditions.push(ilike(hostels.name, hostelFilter)!);
	}

	if (batchYearFilter) {
		const batchYearNum = parseInt(batchYearFilter);
		if (!isNaN(batchYearNum)) {
			whereConditions.push(eq(batches.batch_year, batchYearNum));
		}
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
			hostel: hostels.name,
			class_section: class_sections.name,
			batch_year: batches.batch_year,
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

	// Get total count
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

	return (
		<StudentsManagement
			initialStudents={studentsData}
			initialBatches={availableBatches}
			initialHostels={availableHostels}
			initialPagination={{
				page,
				limit,
				total: totalCount,
				totalPages,
			}}
			initialSearch={search}
			initialHostelFilter={hostelFilter || "all"}
			initialBatchYearFilter={batchYearFilter || "all"}
		/>
	);
}
