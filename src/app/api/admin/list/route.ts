import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";

export async function GET(request: NextRequest) {
	try {
		const { userId, sessionClaims } = await auth();
		
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Check if user is admin
		const role = sessionClaims?.metadata?.role;
		const isAdmin = role === "admin" || role === "super_admin";
		
		if (!isAdmin) {
			return NextResponse.json({ error: "Only admins can access this" }, { status: 403 });
		}

		const client = await clerkClient();
		const userList = await client.users.getUserList();

		// Return all users for staff assignment (can link any user to staff)
		const users = userList.data.map(user => ({
			id: user.id,
			firstName: user.firstName || null,
			lastName: user.lastName || null,
			emailAddresses: Array.isArray(user.emailAddresses)
				? user.emailAddresses.map((email: any) => ({
						emailAddress: typeof email?.emailAddress === 'string' ? email.emailAddress : ''
					}))
				: [],
		}));

		return NextResponse.json({ admins: users });
	} catch (error) {
		console.error("Error fetching admins:", error);
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}

