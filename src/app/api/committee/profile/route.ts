import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db, committees, committeeMembers } from "@/db";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = sessionClaims?.metadata?.role;
    if (role !== "committee") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Find the committee this user belongs to
    const memberRecords = await db
      .select()
      .from(committeeMembers)
      .where(eq(committeeMembers.clerkUserId, userId))
      .limit(1);

    if (memberRecords.length === 0) {
      return NextResponse.json({ 
        error: "No committee assigned",
        committee: null,
        members: []
      });
    }

    const memberRecord = memberRecords[0];
    const committeeId = memberRecord.committeeId;

    // Get committee details
    const committeeRecords = await db
      .select()
      .from(committees)
      .where(eq(committees.id, parseInt(committeeId, 10)))
      .limit(1);

    if (committeeRecords.length === 0) {
      return NextResponse.json({ error: "Committee not found" }, { status: 404 });
    }

    const committee = committeeRecords[0];

    // Get all members of this committee
    const allMembers = await db
      .select()
      .from(committeeMembers)
      .where(eq(committeeMembers.committeeId, committeeId));

    // Fetch user details from Clerk for each member
    const client = await clerkClient();
    const membersWithDetails = await Promise.all(
      allMembers.map(async (member) => {
        try {
          const clerkUser = await client.users.getUser(member.clerkUserId);
          return {
            ...member,
            user: {
              firstName: clerkUser.firstName,
              lastName: clerkUser.lastName,
              emailAddresses: Array.isArray(clerkUser.emailAddresses)
                ? clerkUser.emailAddresses.map((email: any) => ({
                    emailAddress: typeof email?.emailAddress === 'string' ? email.emailAddress : ''
                  }))
                : [],
            },
          };
        } catch (error) {
          console.error(`Error fetching user ${member.clerkUserId}:`, error);
          return {
            ...member,
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

