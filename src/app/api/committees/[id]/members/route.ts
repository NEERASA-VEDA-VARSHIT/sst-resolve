import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, committees, users } from "@/db";
import { eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";

// GET - Get the member (head) of a committee
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

    // Get committee with head
    const [committee] = await db
      .select({
        id: committees.id,
        name: committees.name,
        head_id: committees.head_id,
      })
      .from(committees)
      .where(eq(committees.id, committeeId))
      .limit(1);

    if (!committee) {
      return NextResponse.json({ error: "Committee not found" }, { status: 404 });
    }

    if (!committee.head_id) {
      return NextResponse.json({ members: [] });
    }

    // Get member details from our users table (auth_provider/external_id/full_name/email)
    const [member] = await db
      .select({
        id: users.id,
        auth_provider: users.auth_provider,
        external_id: users.external_id,
        full_name: users.full_name,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, committee.head_id))
      .limit(1);

    if (!member) {
      return NextResponse.json({ members: [] });
    }

    // Shape response to match existing frontend expectations (CommitteeMember + nested user)
    const [firstName, ...restNameParts] = (member.full_name || "").split(" ").filter(Boolean);
    const lastName = restNameParts.length > 0 ? restNameParts.join(" ") : null;

    const memberWithDetails = {
      id: member.id,
      committee_id: committee.id,
      user_id: member.id,
      clerk_user_id: member.external_id, // Clerk user id stored as external_id
      role: "head",
      created_at: null,
      updated_at: null,
      user: {
        firstName: firstName || null,
        lastName,
        emailAddresses: member.email
          ? [{ emailAddress: member.email }]
          : [],
      },
    };

    return NextResponse.json({ members: [memberWithDetails] });
  } catch (error) {
    console.error("Error fetching committee member:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
