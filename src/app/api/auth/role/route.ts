import { NextRequest, NextResponse } from "next/server";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";

/**
 * GET /api/auth/role?userId={clerkId}
 * 
 * Lightweight endpoint for middleware to fetch user role from database
 * Returns role quickly for route authorization
 * 
 * This endpoint is designed for middleware use:
 * - No auth check (middleware already verified userId)
 * - Fast response (<10ms)
 * - Cache disabled (always fresh)
 */
export async function GET(request: NextRequest) {
	try {
		let userId: string | null = null;
		
		try {
			const { searchParams } = new URL(request.url);
			userId = searchParams.get("userId");
		} catch (urlError) {
			console.error("[Auth Role] Error parsing URL:", urlError);
			return NextResponse.json(
				{ role: "student" },
				{
					status: 200,
					headers: {
						"Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
					},
				}
			);
		}

		if (!userId) {
			return NextResponse.json({ error: "userId required" }, { status: 400 });
		}

		// Fetch role from database (single source of truth)
		let role: string = "student";
		try {
			role = await getUserRoleFromDB(userId);
		} catch (dbError) {
			console.error("[Auth Role] Error fetching role from DB:", dbError);
			// Continue with default "student" role
		}

		return NextResponse.json(
			{ role },
			{
				status: 200,
				headers: {
					// Disable caching - always fetch fresh role
					"Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
					"Pragma": "no-cache",
					"Expires": "0",
				},
			}
		);
	} catch (error) {
		console.error("[Auth Role] Unexpected error:", error);
		console.error("[Auth Role] Error stack:", error instanceof Error ? error.stack : "No stack trace");
		// Return default role on error to prevent blocking
		return NextResponse.json(
			{ role: "student" },
			{
				status: 200,
				headers: {
					"Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
				},
			}
		);
	}
}
