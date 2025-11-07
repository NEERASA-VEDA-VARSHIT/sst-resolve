import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db, staff } from "@/db";
import { eq, asc } from "drizzle-orm";

// GET - List all staff members
export async function GET(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = sessionClaims?.metadata?.role;
    if (role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const allStaff = await db
      .select()
      .from(staff)
      .orderBy(asc(staff.domain), asc(staff.scope));

    return NextResponse.json({ staff: allStaff });
  } catch (error) {
    console.error("Error fetching staff:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST - Create new staff member
export async function POST(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = sessionClaims?.metadata?.role;
    if (role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { domain, scope, role: staffRole, clerkUserId, slackUserId, whatsappNumber } = body;

    // Validation
    if (!clerkUserId || !domain || !staffRole) {
      return NextResponse.json({ error: "clerkUserId, domain, and role are required" }, { status: 400 });
    }

    // Fetch user details from Clerk
    let fullName = "";
    let email = "";
    try {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(clerkUserId);
      fullName = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "Unknown";
      email = clerkUser.emailAddresses[0]?.emailAddress || null;
    } catch (error) {
      console.error("Error fetching Clerk user:", error);
      return NextResponse.json({ error: "Failed to fetch user details from Clerk" }, { status: 400 });
    }

    if (domain !== "Hostel" && domain !== "College") {
      return NextResponse.json({ error: "domain must be 'Hostel' or 'College'" }, { status: 400 });
    }

    if (staffRole !== "admin" && staffRole !== "super_admin") {
      return NextResponse.json({ error: "role must be 'admin' or 'super_admin'" }, { status: 400 });
    }

    // If domain is Hostel, scope should be Velankani or Neeladri
    if (domain === "Hostel" && scope && scope !== "Velankani" && scope !== "Neeladri") {
      return NextResponse.json({ error: "scope must be 'Velankani' or 'Neeladri' for Hostel domain" }, { status: 400 });
    }

    // If domain is College, scope should be null
    if (domain === "College" && scope) {
      return NextResponse.json({ error: "scope must be null for College domain" }, { status: 400 });
    }

    const [newStaff] = await db
      .insert(staff)
      .values({
        fullName,
        email: email || null,
        domain,
        scope: scope || null,
        role: staffRole,
        clerkUserId: clerkUserId || null,
        slackUserId: slackUserId || null,
        whatsappNumber: whatsappNumber || null,
      })
      .returning();

    return NextResponse.json({ staff: newStaff }, { status: 201 });
  } catch (error) {
    console.error("Error creating staff:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PATCH - Update staff member
export async function PATCH(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = sessionClaims?.metadata?.role;
    if (role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, domain, scope, role: staffRole, clerkUserId, slackUserId, whatsappNumber } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updateData: any = {};
    if (domain !== undefined) updateData.domain = domain;
    if (scope !== undefined) updateData.scope = scope;
    if (staffRole !== undefined) updateData.role = staffRole;
    if (slackUserId !== undefined) updateData.slackUserId = slackUserId;
    if (whatsappNumber !== undefined) updateData.whatsappNumber = whatsappNumber;
    
    // If clerkUserId is being updated, fetch new user details
    if (clerkUserId !== undefined && clerkUserId) {
      updateData.clerkUserId = clerkUserId;
      try {
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(clerkUserId);
        updateData.fullName = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "Unknown";
        updateData.email = clerkUser.emailAddresses[0]?.emailAddress || null;
      } catch (error) {
        console.error("Error fetching Clerk user:", error);
        return NextResponse.json({ error: "Failed to fetch user details from Clerk" }, { status: 400 });
      }
    }
    
    updateData.updatedAt = new Date();

    const [updatedStaff] = await db
      .update(staff)
      .set(updateData)
      .where(eq(staff.id, id))
      .returning();

    if (!updatedStaff) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }

    return NextResponse.json({ staff: updatedStaff });
  } catch (error) {
    console.error("Error updating staff:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE - Delete staff member
export async function DELETE(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = sessionClaims?.metadata?.role;
    if (role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await db
      .delete(staff)
      .where(eq(staff.id, parseInt(id, 10)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting staff:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

