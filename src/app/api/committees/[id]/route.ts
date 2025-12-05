import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, committees, users, roles } from "@/db";
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
    
    // Snr Admin and Super Admin can update committees
    if (role !== "super_admin" && role !== "snr_admin") {
      return NextResponse.json({ error: "Only senior admins and super admins can update committees" }, { status: 403 });
    }

    const { id } = await params;
    const committeeId = parseInt(id, 10);

    if (isNaN(committeeId)) {
      return NextResponse.json({ error: "Invalid committee ID" }, { status: 400 });
    }

    const body = await request.json();
    const { name, description, contact_email } = body;

    // Verify committee exists and get current head_id
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
      .where(eq(committees.id, committeeId))
      .limit(1);

    if (!committee) {
      return NextResponse.json({ error: "Committee not found" }, { status: 404 });
    }

    const updateData: {
      name?: string;
      description?: string | null;
      contact_email?: string | null;
      head_id?: string | null;
      updated_at: Date;
    } = {
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
      const normalizedNewEmail = contact_email
        ? contact_email.trim().toLowerCase()
        : null;

      // Validate email format if provided
      if (normalizedNewEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedNewEmail)) {
          return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
        }
      }

      // Check if email is actually changing
      const currentEmail = committee.contact_email?.toLowerCase() || null;
      const emailChanged = normalizedNewEmail !== currentEmail;

      if (emailChanged && normalizedNewEmail) {
        // Find the new head user by email
        const [newHeadUser] = await db
          .select({
            id: users.id,
            email: users.email,
          })
          .from(users)
          .where(eq(users.email, normalizedNewEmail))
          .limit(1);

        if (!newHeadUser) {
          return NextResponse.json(
            {
              error:
                "No user found with this email. Please ensure the committee head has a user account before updating.",
            },
            { status: 400 },
          );
        }

        // Ensure new user is not already head of another committee
        const [existingHeadCommittee] = await db
          .select({
            id: committees.id,
            name: committees.name,
          })
          .from(committees)
          .where(eq(committees.head_id, newHeadUser.id))
          .limit(1);

        if (existingHeadCommittee && existingHeadCommittee.id !== committeeId) {
          return NextResponse.json(
            {
              error: `User with email ${normalizedNewEmail} is already the head of committee '${existingHeadCommittee.name}'`,
            },
            { status: 400 },
          );
        }

        // Get role IDs
        const [studentRole] = await db
          .select({ id: roles.id })
          .from(roles)
          .where(eq(roles.name, "student"))
          .limit(1);

        const [committeeRole] = await db
          .select({ id: roles.id })
          .from(roles)
          .where(eq(roles.name, "committee"))
          .limit(1);

        if (!studentRole || !committeeRole) {
          return NextResponse.json(
            { error: "Required roles (student, committee) not found in database" },
            { status: 500 },
          );
        }

        // If there was an old head, change their role back to student
        if (committee.head_id) {
          await db
            .update(users)
            .set({
              role_id: studentRole.id,
              updated_at: new Date(),
            })
            .where(eq(users.id, committee.head_id));
        }

        // Change new head's role to committee
        await db
          .update(users)
          .set({
            role_id: committeeRole.id,
            updated_at: new Date(),
          })
          .where(eq(users.id, newHeadUser.id));

        // Update committee with new head_id and email
        updateData.head_id = newHeadUser.id;
        updateData.contact_email = normalizedNewEmail;
      } else if (normalizedNewEmail === null) {
        // If email is being cleared, also clear head_id and revert old head to student
        if (committee.head_id) {
          const [studentRole] = await db
            .select({ id: roles.id })
            .from(roles)
            .where(eq(roles.name, "student"))
            .limit(1);

          if (studentRole) {
            await db
              .update(users)
              .set({
                role_id: studentRole.id,
                updated_at: new Date(),
              })
              .where(eq(users.id, committee.head_id));
          }
        }
        updateData.head_id = null;
        updateData.contact_email = null;
      } else {
        // Email unchanged, just update the field (normalize it)
        updateData.contact_email = normalizedNewEmail;
      }
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
    
    // Snr Admin and Super Admin can delete committees
    if (role !== "super_admin" && role !== "snr_admin") {
      return NextResponse.json({ error: "Only senior admins and super admins can delete committees" }, { status: 403 });
    }

    const { id } = await params;
    const committeeId = parseInt(id, 10);

    if (isNaN(committeeId)) {
      return NextResponse.json({ error: "Invalid committee ID" }, { status: 400 });
    }

    // Verify committee exists and get head_id
    const [committee] = await db
      .select({
        id: committees.id,
        name: committees.name,
        description: committees.description,
        head_id: committees.head_id,
        created_at: committees.created_at,
        updated_at: committees.updated_at,
      })
      .from(committees)
      .where(eq(committees.id, committeeId))
      .limit(1);

    if (!committee) {
      return NextResponse.json({ error: "Committee not found" }, { status: 404 });
    }

    // If there's a head, revert their role back to student before deleting
    if (committee.head_id) {
      const [studentRole] = await db
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.name, "student"))
        .limit(1);

      if (studentRole) {
        await db
          .update(users)
          .set({
            role_id: studentRole.id,
            updated_at: new Date(),
          })
          .where(eq(users.id, committee.head_id));
      }
    }

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

