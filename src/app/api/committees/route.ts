import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, committees } from "@/db";
import { eq } from "drizzle-orm";
import { getOrCreateUser } from "@/lib/user-sync";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { fastAuthCheck, isAuthError } from "@/lib/fast-auth";

// GET - Get all committees (for admin tagging dropdown)
export async function GET(request: NextRequest) {
  try {
    // Fast auth check (skips user sync for read operation)
    const authResult = await fastAuthCheck(["admin", "super_admin", "committee"]);
    
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
    
    if (role !== "super_admin") {
      return NextResponse.json({ error: "Only super admins can create committees" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, contact_email } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Committee name is required" }, { status: 400 });
    }

    // Validate email format if provided
    if (contact_email && typeof contact_email === "string" && contact_email.trim().length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contact_email.trim())) {
        return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
      }
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

    const [newCommittee] = await db
      .insert(committees)
      .values({
        name: name.trim(),
        description: description?.trim() || null,
        contact_email: contact_email?.trim() || null,
      })
      .returning();

    return NextResponse.json({ committee: newCommittee }, { status: 201 });
  } catch (error) {
    console.error("Error creating committee:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

