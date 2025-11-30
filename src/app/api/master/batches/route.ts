import { NextResponse } from "next/server";
import { db, batches } from "@/db";
import { eq, desc } from "drizzle-orm";

/**
 * GET /api/master/batches
 * Fetch all active batches for dropdowns
 */
export async function GET() {
	try {
		const batchesList = await db
			.select({
				id: batches.id,
				batch_year: batches.batch_year,
			})
			.from(batches)
			.where(eq(batches.is_active, true))
			.orderBy(desc(batches.batch_year));

		return NextResponse.json({ batches: batchesList });
	} catch (error) {
		console.error("Error fetching batches:", error);
		return NextResponse.json(
			{ error: "Failed to fetch batches" },
			{ status: 500 }
		);
	}
}

