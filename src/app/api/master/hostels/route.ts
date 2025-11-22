import { NextResponse } from "next/server";
import { db, hostels } from "@/db";
import { eq, asc } from "drizzle-orm";

/**
 * GET /api/master/hostels
 * Fetch all active hostels for dropdowns
 */
export async function GET() {
	try {
		const hostelsList = await db
			.select({
				id: hostels.id,
				name: hostels.name,
				code: hostels.code,
			})
			.from(hostels)
			.where(eq(hostels.is_active, true))
			.orderBy(asc(hostels.name));

		return NextResponse.json({ hostels: hostelsList });
	} catch (error) {
		console.error("Error fetching hostels:", error);
		return NextResponse.json(
			{ error: "Failed to fetch hostels" },
			{ status: 500 }
		);
	}
}

