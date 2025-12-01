import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db, users, roles, domains, scopes, admin_profiles } from "@/db";
import { eq, inArray } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";

interface ClerkUser {
	id: string;
	firstName: string | null;
	lastName: string | null;
	emailAddresses?: Array<{ emailAddress: string }>;
}

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

		// Get admins and super admins from users table
		const adminUsers = await db
			.select({
				id: users.id,
				external_id: users.external_id,
				full_name: users.full_name,
				email: users.email,
				domain: domains.name,
				scope: scopes.name,
				role_name: roles.name,
			})
			.from(users)
			.leftJoin(roles, eq(users.role_id, roles.id))
			.leftJoin(admin_profiles, eq(admin_profiles.user_id, users.id))
			.leftJoin(domains, eq(admin_profiles.primary_domain_id, domains.id))
			.leftJoin(scopes, eq(admin_profiles.primary_scope_id, scopes.id))
			.where(inArray(roles.name, ["admin", "super_admin"]));

		const adminsWithExternalId = adminUsers.filter((admin) => !!admin.external_id && admin.external_id.startsWith("user_"));
		const client = await clerkClient();

		const detailedAdmins = await Promise.all(
			adminsWithExternalId.map(async (admin) => {
				try {
					// Try to get latest details from Clerk, fallback to DB
					let user: ClerkUser | null = null;
					try {
						user = await client.users.getUser(admin.external_id!) as ClerkUser;
					} catch {
						// Ignore Clerk fetch error, use DB data
					}

					const primaryEmail = user && Array.isArray(user.emailAddresses) && user.emailAddresses.length > 0
						? user.emailAddresses[0]?.emailAddress || admin.email || ""
						: admin.email || "";

					const name = user
						? [user.firstName, user.lastName].filter(Boolean).join(" ")
						: admin.full_name || primaryEmail || "Admin";

					return {
						id: admin.id, // Database UUID (for category_assignments.user_id matching)
						external_id: user ? user.id : admin.external_id, // Clerk ID (for display/fallback)
						name,
						email: primaryEmail,
						domain: admin.domain,
						scope: admin.scope,
						role: admin.role_name || "admin",
					};
				} catch (error) {
					console.error("Error processing admin user", admin.external_id, error);
					return {
						id: admin.id, // Database UUID (for category_assignments.user_id matching)
						external_id: admin.external_id || "", // Clerk ID (for display/fallback)
						name: admin.full_name || admin.email || "Unknown",
						email: admin.email || "",
						domain: admin.domain,
						scope: admin.scope,
						role: admin.role_name || "admin",
					};
				}
			})
		);

		// If include_committee is requested, fetch users with committee role from database
		let committeeUsers: Array<{
			id: string;
			firstName: string | null;
			lastName: string | null;
			emailAddresses: Array<{ emailAddress: string }>;
			name: string;
			email: string;
			publicMetadata: { role: string };
		}> = [];
		if (includeCommittee) {
			try {
				// Get all users with committee role
				const committeeRoleUsers = await db
					.select({
						external_id: users.external_id,
						full_name: users.full_name,
						email: users.email,
					})
					.from(users)
					.leftJoin(roles, eq(users.role_id, roles.id))
					.where(eq(roles.name, "committee"));

				// Fetch Clerk user details for committee members
				// Optimization: If list is small, fetch individually or rely on DB data
				// For now, let's try to fetch from Clerk if possible, but fallback to DB

				committeeUsers = await Promise.all(committeeRoleUsers
					.filter(user => user.external_id && user.external_id.startsWith("user_"))
					.map(async (dbUser) => {
						let clerkUser: ClerkUser | null = null;
						try {
							clerkUser = await client.users.getUser(dbUser.external_id!) as ClerkUser;
						} catch {
							// Ignore
						}

						const primaryEmail = clerkUser && Array.isArray(clerkUser.emailAddresses)
							? clerkUser.emailAddresses[0]?.emailAddress || dbUser.email || ""
							: dbUser.email || "";

						const name = clerkUser
							? [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ")
							: dbUser.full_name || primaryEmail || "Committee Member";

						return {
							id: clerkUser ? clerkUser.id : dbUser.external_id!,
							firstName: clerkUser ? clerkUser.firstName : null,
							lastName: clerkUser ? clerkUser.lastName : null,
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
