import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db, staff } from "@/db";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
	try {
		const { userId, sessionClaims } = await auth();
		
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Only super admins can access full admin roster for reassignment
		const role = sessionClaims?.metadata?.role;
		if (role !== "super_admin") {
			return NextResponse.json({ error: "Only super admins can access this" }, { status: 403 });
		}

		const staffAdmins = await db
			.select()
			.from(staff)
			.where(eq(staff.role, "admin"));

		const adminsWithClerkId = staffAdmins.filter((admin) => !!admin.clerkUserId);
		const client = await clerkClient();

		const detailedAdmins = await Promise.all(
			adminsWithClerkId.map(async (admin) => {
				try {
					const user = await client.users.getUser(admin.clerkUserId!);
					const primaryEmail = Array.isArray(user.emailAddresses) && user.emailAddresses.length > 0
						? user.emailAddresses[0]?.emailAddress || admin.email || ""
						: admin.email || "";

					const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || admin.fullName || primaryEmail || "Admin";

					return {
						id: user.id,
						name,
						email: primaryEmail,
						domain: admin.domain,
						scope: admin.scope,
					};
				} catch (error) {
					console.error("Error fetching clerk user for admin", admin.clerkUserId, error);
					return {
						id: admin.clerkUserId!,
						name: admin.fullName,
						email: admin.email || "",
						domain: admin.domain,
						scope: admin.scope,
					};
				}
			})
		);

		return NextResponse.json({ admins: detailedAdmins });
	} catch (error) {
		console.error("Error fetching admins:", error);
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}

