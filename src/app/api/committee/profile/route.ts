import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db, committees, committee_members, users } from "@/db";
import { eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user exists in database
    await getOrCreateUser(userId);

    // Get role from database (single source of truth)
    const role = await getUserRoleFromDB(userId);
    
    if (role !== "committee") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Ensure user exists and get user_id
    const user = await getOrCreateUser(userId);

    // Find the committee this user belongs to (using user_id FK)
    const memberRecords = await db
      .select({ committee_id: committee_members.committee_id })
      .from(committee_members)
      .where(eq(committee_members.user_id, user.id))
      .limit(1);

    if (memberRecords.length === 0) {
      return NextResponse.json({ 
        error: "No committee assigned",
        committee: null,
        members: []
      });
    }

    const committeeId = memberRecords[0].committee_id;

    // Get committee details
    const [committee] = await db
      .select()
      .from(committees)
      .where(eq(committees.id, committeeId))
      .limit(1);

    if (!committee) {
      return NextResponse.json({ error: "Committee not found" }, { status: 404 });
    }

    // Get all members of this committee (join with users to get clerk_id)
    const allMembers = await db
      .select({
        id: committee_members.id,
        committee_id: committee_members.committee_id,
        user_id: committee_members.user_id,
        role: committee_members.role,
        created_at: committee_members.created_at,
        updated_at: committee_members.updated_at,
        clerk_id: users.clerk_id,
      })
      .from(committee_members)
      .innerJoin(users, eq(committee_members.user_id, users.id))
      .where(eq(committee_members.committee_id, committeeId));

    // Fetch user details from Clerk for each member
    const client = await clerkClient();
    const membersWithDetails = await Promise.all(
      allMembers.map(async (member) => {
        try {
          const clerkUser = await client.users.getUser(member.clerk_id);
          return {
            id: member.id,
            committee_id: member.committee_id,
            user_id: member.user_id,
            role: member.role,
            created_at: member.created_at,
            updated_at: member.updated_at,
            user: {
              firstName: clerkUser.firstName,
              lastName: clerkUser.lastName,
              emailAddresses: Array.isArray(clerkUser.emailAddresses)
                ? clerkUser.emailAddresses.map((email: { emailAddress?: string }) => ({
                    emailAddress: typeof email?.emailAddress === 'string' ? email.emailAddress : ''
                  }))
                : [],
            },
          };
        } catch (error) {
          console.error(`Error fetching user ${member.clerk_id}:`, error);
          return {
            id: member.id,
            committee_id: member.committee_id,
            user_id: member.user_id,
            role: member.role,
            created_at: member.created_at,
            updated_at: member.updated_at,
            user: undefined,
          };
        }
      })
    );

    return NextResponse.json({
      committee,
      members: membersWithDetails,
    });
  } catch (error) {
    console.error("Error fetching committee profile:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

