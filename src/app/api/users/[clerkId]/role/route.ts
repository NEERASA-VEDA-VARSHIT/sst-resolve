import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserRoleFromDB, getUserRoles, setUserRole, removeUserRole } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";
import type { UserRole } from "@/types/auth";

/**
 * GET - Get user's role from database
 * Used by client components that can't access database directly
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clerkId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clerkId } = await params;
    
    // Get primary role (highest priority)
    const primaryRole = await getUserRoleFromDB(clerkId);
    
    // Get all roles with scoping info
    const allRoles = await getUserRoles(clerkId);

    return NextResponse.json({
      primaryRole,
      allRoles,
    });
  } catch (error) {
    console.error("Error fetching user role:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST - Set user's role in database
 * Only super_admin can set roles
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clerkId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user exists in database
    await getOrCreateUser(userId);

    // Get role from database (single source of truth)
    const currentUserRole = await getUserRoleFromDB(userId);
    
    if (currentUserRole !== "super_admin") {
      return NextResponse.json({ error: "Forbidden - Only super_admin can set roles" }, { status: 403 });
    }

    const { clerkId } = await params;
    const body = await request.json();
    const { role, domain, scope } = body;

    // Validation
    if (!role) {
      return NextResponse.json({ error: "role is required" }, { status: 400 });
    }

    const validRoles: UserRole[] = ["student", "admin", "super_admin", "committee"];
    if (!validRoles.includes(role as UserRole)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` }, { status: 400 });
    }

    // Ensure target user exists in database
    await getOrCreateUser(clerkId);

    // Set the role
    await setUserRole(clerkId, role as UserRole, {
      domain: domain || null,
      scope: scope || null,
      grantedBy: userId,
    });

    // AUTOMATIC CLEANUP: Remove "student" role when assigning elevated roles
    // This keeps the role list clean - users only have their elevated role
    const elevatedRoles: UserRole[] = ["admin", "super_admin", "committee"];
    if (elevatedRoles.includes(role as UserRole)) {
      try {
        // Get all current roles to check if student role exists
        const currentRoles = await getUserRoles(clerkId);
        const hasStudentRole = currentRoles.some(r => r.role === "student");
        
        if (hasStudentRole) {
          await removeUserRole(clerkId, "student");
          console.log(`[Role Assignment] Auto-removed student role from ${clerkId} after assigning ${role}`);
        }
      } catch (error) {
        // Don't fail the request if cleanup fails - elevated role is already assigned
        console.warn(`[Role Assignment] Failed to auto-remove student role from ${clerkId}:`, error);
      }
    }

    return NextResponse.json({ success: true, message: `Role ${role} assigned successfully` });
  } catch (error) {
    console.error("Error setting user role:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * DELETE - Remove user's role from database
 * Only super_admin can remove roles
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clerkId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user exists in database
    await getOrCreateUser(userId);

    // Get role from database (single source of truth)
    const currentUserRole = await getUserRoleFromDB(userId);
    
    if (currentUserRole !== "super_admin") {
      return NextResponse.json({ error: "Forbidden - Only super_admin can remove roles" }, { status: 403 });
    }

    const { clerkId } = await params;
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role") as UserRole | null;
    const domain = searchParams.get("domain");
    const scope = searchParams.get("scope");

    // If no role specified, remove all non-student roles (keep student as default)
    if (!role) {
      const allRoles = await getUserRoles(clerkId);
      for (const userRole of allRoles) {
        if (userRole.role !== "student") {
          await removeUserRole(clerkId, userRole.role, {
            domain: userRole.domain,
            scope: userRole.scope,
          });
        }
      }
      return NextResponse.json({ success: true, message: "All non-student roles removed" });
    }

    // Remove specific role
    await removeUserRole(clerkId, role, {
      domain: domain || null,
      scope: scope || null,
    });

    return NextResponse.json({ success: true, message: `Role ${role} removed successfully` });
  } catch (error) {
    console.error("Error removing user role:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
