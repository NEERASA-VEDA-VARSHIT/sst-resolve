import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db, committees, users } from "@/db";
import { eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";

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

    // Find the committee this user is the head of (using head_id)
    const [committee] = await db
      .select({
        id: committees.id,
        name: committees.name,
        description: committees.description,
        contact_email: committees.contact_email,
        head_id: committees.head_id,
        created_at: committees.created_at,
        updated_at: committees.updated_at,
      })
      .from(committees)
      .where(eq(committees.head_id, user.id))
      .limit(1);

    if (!committee) {
      return NextResponse.json({ 
        error: "No committee assigned",
        committee: null,
        members: []
      });
    }

    // Get the single member (head) of this committee
    let member = null;
    if (committee.head_id) {
      const [memberData] = await db
        .select({
          id: users.id,
          external_id: users.external_id,
          full_name: users.full_name,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, committee.head_id))
        .limit(1);
      member = memberData || null;
    }

    // Fetch user details from Clerk for the member
    const client = await clerkClient();
    let memberWithDetails;
    
    if (member && member.external_id) {
      try {
        const clerkUser = await client.users.getUser(member.external_id);
        memberWithDetails = {
          id: member.id,
          committee_id: committee.id,
          user_id: member.id,
          role: "head",
          created_at: committee.created_at,
          updated_at: committee.updated_at,
          user: {
            fullName: member.full_name || (clerkUser.firstName || clerkUser.lastName ? `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() : null),
            emailAddresses: Array.isArray(clerkUser.emailAddresses)
              ? clerkUser.emailAddresses.map((email: { emailAddress?: string }) => ({
                  emailAddress: typeof email?.emailAddress === 'string' ? email.emailAddress : ''
                }))
              : [],
          },
        };
      } catch (error) {
        console.error(`Error fetching user ${member.external_id}:`, error);
        memberWithDetails = {
          id: member.id,
          committee_id: committee.id,
          user_id: member.id,
          role: "head",
          created_at: committee.created_at,
          updated_at: committee.updated_at,
          user: undefined,
        };
      }
    }

    return NextResponse.json({
      committee: {
        id: committee.id,
        name: committee.name,
        description: committee.description,
        contact_email: committee.contact_email,
        created_at: committee.created_at,
        updated_at: committee.updated_at,
      },
      members: memberWithDetails ? [memberWithDetails] : [],
    });
  } catch (error) {
    console.error("Error fetching committee profile:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
