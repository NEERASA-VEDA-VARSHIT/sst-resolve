import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db, users, roles, domains, scopes } from "@/db";
import { eq, and, or, sql } from "drizzle-orm";
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

		// Get admins from users table
		const adminUsers = await db
			.select({
				id: users.id,
				clerk_id: users.clerk_id,
				first_name: users.first_name,
				last_name: users.last_name,
				email: users.email,
				domain: domains.name,
				scope: scopes.name,
			})
			.from(users)
			.leftJoin(roles, eq(users.role_id, roles.id))
			.leftJoin(domains, eq(users.primary_domain_id, domains.id))
			.leftJoin(scopes, eq(users.primary_scope_id, scopes.id))
			.where(eq(roles.name, "admin"));

		const adminsWithClerkId = adminUsers.filter((admin) => !!admin.clerk_id);
		const client = await clerkClient();

		const detailedAdmins = await Promise.all(
			adminsWithClerkId.map(async (admin) => {
				try {
					// Try to get latest details from Clerk, fallback to DB
					let user: any = null;
					try {
						user = await client.users.getUser(admin.clerk_id);
					} catch (e) {
						// Ignore Clerk fetch error, use DB data
					}

					const primaryEmail = user && Array.isArray(user.emailAddresses) && user.emailAddresses.length > 0
						? user.emailAddresses[0]?.emailAddress || admin.email || ""
						: admin.email || "";

					const name = user
						? [user.firstName, user.lastName].filter(Boolean).join(" ")
						: [admin.first_name, admin.last_name].filter(Boolean).join(" ") || primaryEmail || "Admin";

					return {
						id: user ? user.id : admin.clerk_id,
						name,
						email: primaryEmail,
						domain: admin.domain,
						scope: admin.scope,
					};
				} catch (error) {
					console.error("Error processing admin user", admin.clerk_id, error);
					return {
						id: admin.clerk_id,
						name: [admin.first_name, admin.last_name].filter(Boolean).join(" ") || admin.email || "Unknown",
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
				// Get all users with committee role
				const committeeRoleUsers = await db
					.select({
						clerk_id: users.clerk_id,
						first_name: users.first_name,
						last_name: users.last_name,
						email: users.email,
					})
					.from(users)
					.leftJoin(roles, eq(users.role_id, roles.id))
					.where(eq(roles.name, "committee"));

				// Fetch Clerk user details for committee members
				// Optimization: If list is small, fetch individually or rely on DB data
				// For now, let's try to fetch from Clerk if possible, but fallback to DB

				committeeUsers = await Promise.all(committeeRoleUsers.map(async (dbUser) => {
					let clerkUser: any = null;
					try {
						clerkUser = await client.users.getUser(dbUser.clerk_id);
					} catch (e) {
						// Ignore
					}

					const primaryEmail = clerkUser && Array.isArray(clerkUser.emailAddresses)
						? clerkUser.emailAddresses[0]?.emailAddress || dbUser.email || ""
						: dbUser.email || "";

					const name = clerkUser
						? [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ")
						: [dbUser.first_name, dbUser.last_name].filter(Boolean).join(" ") || primaryEmail || "Committee Member";

					return {
						id: clerkUser ? clerkUser.id : dbUser.clerk_id,
						firstName: clerkUser ? clerkUser.firstName : dbUser.first_name,
						lastName: clerkUser ? clerkUser.lastName : dbUser.last_name,
						emailAddresses: [{ emailAddress: primaryEmail }],
						name,
						email: primaryEmail,
						publicMetadata: { role: "committee" },
					};
				}));

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
