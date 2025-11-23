import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, committees, committee_members } from "@/db";
import { eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";

// PATCH - Update a committee
export async function PATCH(
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
      return NextResponse.json({ error: "Only super admins can update committees" }, { status: 403 });
    }

    const { id } = await params;
    const committeeId = parseInt(id, 10);

    if (isNaN(committeeId)) {
      return NextResponse.json({ error: "Invalid committee ID" }, { status: 400 });
    }

    const body = await request.json();
    const { name, description, contact_email } = body;

    // Verify committee exists
    const [committee] = await db
      .select({
        id: committees.id,
        name: committees.name,
        description: committees.description,
        contact_email: committees.contact_email,
        created_at: committees.created_at,
        updated_at: committees.updated_at,
      })
      .from(committees)
      .where(eq(committees.id, committeeId))
      .limit(1);

    if (!committee) {
      return NextResponse.json({ error: "Committee not found" }, { status: 404 });
    }

    const updateData: { name?: string; description?: string | null; contact_email?: string | null; updated_at: Date } = {
      updated_at: new Date(),
    };

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ error: "Committee name cannot be empty" }, { status: 400 });
      }
      // Check if another committee with same name exists
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
      if (existing && existing.id !== committeeId) {
        return NextResponse.json({ error: "A committee with this name already exists" }, { status: 400 });
      }
      updateData.name = name.trim();
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    if (contact_email !== undefined) {
      // Validate email format if provided
      if (contact_email && typeof contact_email === "string" && contact_email.trim().length > 0) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(contact_email.trim())) {
          return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
        }
      }
      updateData.contact_email = contact_email?.trim() || null;
    }

    const [updatedCommittee] = await db
      .update(committees)
      .set(updateData)
      .where(eq(committees.id, committeeId))
      .returning();

    return NextResponse.json({ committee: updatedCommittee });
  } catch (error) {
    console.error("Error updating committee:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE - Delete a committee
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
      return NextResponse.json({ error: "Only super admins can delete committees" }, { status: 403 });
    }

    const { id } = await params;
    const committeeId = parseInt(id, 10);

    if (isNaN(committeeId)) {
      return NextResponse.json({ error: "Invalid committee ID" }, { status: 400 });
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

    // Delete all committee members first (cascade should handle this, but being explicit)
    await db
      .delete(committee_members)
      .where(eq(committee_members.committee_id, committeeId));

    // Delete the committee
    await db
      .delete(committees)
      .where(eq(committees.id, committeeId));

    return NextResponse.json({ message: "Committee deleted successfully" });
  } catch (error) {
    console.error("Error deleting committee:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

