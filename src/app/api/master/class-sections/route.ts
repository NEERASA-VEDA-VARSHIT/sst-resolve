import { NextResponse } from "next/server";
import { db, class_sections } from "@/db";
import { eq, asc } from "drizzle-orm";

/**
 * GET /api/master/class-sections
 * Fetch all active class sections for dropdowns
 */
export async function GET() {
	try {
		const sectionsList = await db
			.select({
				id: class_sections.id,
				name: class_sections.name,
			})
			.from(class_sections)
			.where(eq(class_sections.is_active, true))
			.orderBy(asc(class_sections.name));

		return NextResponse.json({ sections: sectionsList });
	} catch (error) {
		console.error("Error fetching class sections:", error);
		return NextResponse.json(
			{ error: "Failed to fetch class sections" },
			{ status: 500 }
		);
	}
}

