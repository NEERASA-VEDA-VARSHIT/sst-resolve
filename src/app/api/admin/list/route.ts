import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db, staff, users, roles, user_roles } from "@/db";
import { eq, and } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";

export async function GET(request: NextRequest) {
	try {
		const { userId } = await auth();
		
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Ensure user exists in database
		await getOrCreateUser(userId);

		// Get role from database (single source of truth)
		const role = await getUserRoleFromDB(userId);
		
		// Only super admins can access full admin roster for reassignment
		if (role !== "super_admin") {
			return NextResponse.json({ error: "Only super admins can access this" }, { status: 403 });
		}

		const { searchParams } = new URL(request.url);
		const includeCommittee = searchParams.get("include_committee") === "true";

		// Join with users and user_roles to get admins (multi-role support)
		const staffAdmins = await db
			.select({
				id: staff.id,
				clerk_id: users.clerk_id,
				full_name: staff.full_name,
				email: staff.email,
				domain: staff.domain,
				scope: staff.scope,
			})
			.from(staff)
			.innerJoin(users, eq(staff.user_id, users.id))
			.innerJoin(user_roles, eq(users.id, user_roles.user_id))
			.innerJoin(roles, eq(user_roles.role_id, roles.id))
			.where(eq(roles.name, "admin"));

		const adminsWithClerkId = staffAdmins.filter((admin) => !!admin.clerk_id);
		const client = await clerkClient();

		const detailedAdmins = await Promise.all(
			adminsWithClerkId.map(async (admin) => {
				try {
					const user = await client.users.getUser(admin.clerk_id);
					const primaryEmail = Array.isArray(user.emailAddresses) && user.emailAddresses.length > 0
						? user.emailAddresses[0]?.emailAddress || admin.email || ""
						: admin.email || "";

					const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || admin.full_name || primaryEmail || "Admin";

					return {
						id: user.id,
						name,
						email: primaryEmail,
						domain: admin.domain,
						scope: admin.scope,
					};
				} catch (error) {
					console.error("Error fetching clerk user for admin", admin.clerk_id, error);
					return {
						id: admin.clerk_id,
						name: admin.full_name,
						email: admin.email || "",
						domain: admin.domain,
						scope: admin.scope,
					};
				}
			})
		);

		// If include_committee is requested, fetch users with committee role from database
		let committeeUsers: any[] = [];
		if (includeCommittee) {
			try {
				// Get all users with committee role from database using user_roles join table
				const committeeRoleUsers = await db
					.select({
						clerk_id: users.clerk_id,
					})
					.from(users)
					.innerJoin(user_roles, eq(users.id, user_roles.user_id))
					.innerJoin(roles, eq(user_roles.role_id, roles.id))
					.where(eq(roles.name, "committee"));

				// Fetch Clerk user details for committee members
				const allUsers = await client.users.getUserList({ limit: 500 });
				const committeeClerkIds = new Set(committeeRoleUsers.map(u => u.clerk_id));
				
				committeeUsers = allUsers.data
					.filter((user) => committeeClerkIds.has(user.id))
					.map((user) => {
						const primaryEmail = Array.isArray(user.emailAddresses) && user.emailAddresses.length > 0
							? user.emailAddresses[0]?.emailAddress || ""
							: "";
						const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || primaryEmail || "Committee Member";
						
						return {
							id: user.id,
							firstName: user.firstName,
							lastName: user.lastName,
							emailAddresses: Array.isArray(user.emailAddresses)
								? user.emailAddresses.map((email: any) => ({ emailAddress: email.emailAddress }))
								: [],
							name,
							email: primaryEmail,
							publicMetadata: { role: "committee" }, // Use database role
						};
					});
			} catch (error) {
				console.error("Error fetching committee users:", error);
			}
		}

		return NextResponse.json({ 
			admins: detailedAdmins,
			...(includeCommittee && { committeeUsers }),
		});
	} catch (error) {
		console.error("Error fetching admins:", error);
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}

