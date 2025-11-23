import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db, committee_members, committees, users } from "@/db";
import { eq, and } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";

// GET - Get all members of a committee
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user exists in database
    await getOrCreateUser(userId);

    // Get role from database (single source of truth)
    const role = await getUserRoleFromDB(userId);
    
    if (role !== "admin" && role !== "super_admin" && role !== "committee") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const committeeId = parseInt(id, 10);

    if (isNaN(committeeId)) {
      return NextResponse.json({ error: "Invalid committee ID" }, { status: 400 });
    }

    // Join with users table to get clerk_id
    const members = await db
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
      members.map(async (member) => {
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
              emailAddresses: clerkUser.emailAddresses.map((email: { emailAddress: string }) => ({
                emailAddress: email.emailAddress,
              })),
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
            user: null,
          };
        }
      })
    );

    return NextResponse.json({ members: membersWithDetails });
  } catch (error) {
    console.error("Error fetching committee members:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST - Add a member to a committee
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user exists in database
    await getOrCreateUser(userId);

    // Get role from database (single source of truth)
    const role = await getUserRoleFromDB(userId);
    
    if (role !== "super_admin") {
      return NextResponse.json({ error: "Only super admins can manage committee members" }, { status: 403 });
    }

    const { id } = await params;
    const committeeId = parseInt(id, 10);

    if (isNaN(committeeId)) {
      return NextResponse.json({ error: "Invalid committee ID" }, { status: 400 });
    }

    const body = await request.json();
    const { clerk_user_id, role: memberRole } = body;

    if (!clerk_user_id) {
      return NextResponse.json({ error: "clerk_user_id is required" }, { status: 400 });
    }

    // Verify committee exists
    const [committee] = await db
      .select({
        id: committees.id,
        name: committees.name,
        description: committees.description,
        created_at: committees.created_at,
        updated_at: committees.updated_at,
      })
      .from(committees)
      .where(eq(committees.id, committeeId))
      .limit(1);

    if (!committee) {
      return NextResponse.json({ error: "Committee not found" }, { status: 404 });
    }

    // Ensure user exists and get user_id
    const user = await getOrCreateUser(clerk_user_id);

    // Check if member already exists
    const [existingMember] = await db
      .select()
      .from(committee_members)
      .where(
        and(
          eq(committee_members.committee_id, committeeId),
          eq(committee_members.user_id, user.id)
        )
      )
      .limit(1);

    if (existingMember) {
      return NextResponse.json({ error: "User is already a member of this committee" }, { status: 400 });
    }

    // Add member using user_id FK
    const [newMember] = await db
      .insert(committee_members)
      .values({
        committee_id: committeeId,
        user_id: user.id, // FK to users table
        role: memberRole || null,
      })
      .returning();

    return NextResponse.json({ member: newMember }, { status: 201 });
  } catch (error) {
    console.error("Error adding committee member:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE - Remove a member from a committee
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user exists in database
    await getOrCreateUser(userId);

    // Get role from database (single source of truth)
    const role = await getUserRoleFromDB(userId);
    
    if (role !== "super_admin") {
      return NextResponse.json({ error: "Only super admins can manage committee members" }, { status: 403 });
    }

    const { id } = await params;
    const committeeId = parseInt(id, 10);

    if (isNaN(committeeId)) {
      return NextResponse.json({ error: "Invalid committee ID" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const clerkUserId = searchParams.get("clerk_user_id");

    if (!clerkUserId) {
      return NextResponse.json({ error: "clerk_user_id is required" }, { status: 400 });
    }

    // Get user_id from clerk_id
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_id, clerkUserId))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Remove member using user_id FK
    await db
      .delete(committee_members)
      .where(
        and(
          eq(committee_members.committee_id, committeeId),
          eq(committee_members.user_id, user.id)
        )
      );

    return NextResponse.json({ message: "Member removed successfully" });
  } catch (error) {
    console.error("Error removing committee member:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

