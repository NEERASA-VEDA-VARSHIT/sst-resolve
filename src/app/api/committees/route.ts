import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, committees, users } from "@/db";
import { eq } from "drizzle-orm";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { fastAuthCheck, isAuthError } from "@/lib/auth/fast-auth";

// GET - Get all committees (for admin tagging dropdown)
export async function GET() {
  try {
    // Fast auth check (skips user sync for read operation)
    const authResult = await fastAuthCheck(["admin", "snr_admin", "super_admin", "committee"]);
    
    // Return error response if auth failed
    if (isAuthError(authResult)) {
      return authResult;
    }

    // Explicitly select only columns that exist in the schema
    const allCommittees = await db
      .select({
        id: committees.id,
        name: committees.name,
        description: committees.description,
        contact_email: committees.contact_email,
        created_at: committees.created_at,
        updated_at: committees.updated_at,
      })
      .from(committees)
      .orderBy(committees.name);

    return NextResponse.json({ committees: allCommittees });
  } catch (error) {
    console.error("Error fetching committees:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST - Create a new committee
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user exists in database
    await getOrCreateUser(userId);

    // Get role from database (single source of truth)
    const role = await getUserRoleFromDB(userId);
    
    // Snr Admin and Super Admin can create committees
    if (role !== "super_admin" && role !== "snr_admin") {
      return NextResponse.json({ error: "Only senior admins and super admins can create committees" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, contact_email } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Committee name is required" }, { status: 400 });
    }

    // Contact email is required and will act as the committee head's email
    if (!contact_email || typeof contact_email !== "string" || contact_email.trim().length === 0) {
      return NextResponse.json({ error: "Contact email is required" }, { status: 400 });
    }

    const normalizedEmail = contact_email.trim().toLowerCase();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Check if committee with same name already exists
    const [existing] = await db
      .select({
        id: committees.id,
        name: committees.name,
        description: committees.description,
        contact_email: committees.contact_email,
        created_at: committees.created_at,
        updated_at: committees.updated_at,
      })
      .from(committees)
      .where(eq(committees.name, name.trim()))
      .limit(1);

    if (existing) {
      return NextResponse.json({ error: "A committee with this name already exists" }, { status: 400 });
    }

    // Find the user who will be the committee head based on email.
    // NOTE: We do NOT auto-create users here. A real user must exist first.
    const [headUser] = await db
      .select({
        id: users.id,
        email: users.email,
      })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!headUser) {
      return NextResponse.json(
        {
          error:
            "No user found with this email. Please ensure the committee head has a user account before creating the committee.",
        },
        { status: 400 },
      );
    }

    // Ensure this user is not already the head of another committee
    const [existingHeadCommittee] = await db
      .select({
        id: committees.id,
        name: committees.name,
      })
      .from(committees)
      .where(eq(committees.head_id, headUser.id))
      .limit(1);

    if (existingHeadCommittee) {
      return NextResponse.json(
        { error: `User with email ${normalizedEmail} is already the head of committee '${existingHeadCommittee.name}'` },
        { status: 400 },
      );
    }

    const [newCommittee] = await db
      .insert(committees)
      .values({
        name: name.trim(),
        description: description?.trim() || null,
        contact_email: normalizedEmail,
        head_id: headUser.id,
      })
      .returning();

    return NextResponse.json({ committee: newCommittee }, { status: 201 });
  } catch (error) {
    console.error("Error creating committee:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

