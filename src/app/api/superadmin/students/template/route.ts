/**
 * GET /api/superadmin/students/template
 * 
 * Download CSV template for student bulk upload
 * SuperAdmin-only endpoint
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";

export async function GET() {
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

		// Generate CSV template
    const headers = [
      "email",
      "full_name",
      "hostel",
      "room_number",
      "class_section",
      "batch_year",
      "mobile",
      "blood_group",
    ];

    const exampleRow = [
      "student@example.com",
      "Neerasa Varshit",
      "Neeladri",
      "212",
      "A",
      "2027",
      "9876543210",
      "O+",
    ];

		const csv = [headers.join(","), exampleRow.join(",")].join("\n");

		return new NextResponse(csv, {
			status: 200,
			headers: {
				"Content-Type": "text/csv",
				"Content-Disposition": 'attachment; filename="student_upload_template.csv"',
			},
		});
	} catch (error: unknown) {
		console.error("Template download error:", error);
		const errorMessage = error instanceof Error ? error.message : "Failed to generate template";
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 },
		);
	}
}
