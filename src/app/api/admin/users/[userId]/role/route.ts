/**
 * PATCH /api/admin/users/[userId]/role
 * 
 * Update a user's role
 * SuperAdmin-only endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const { userId: currentUserId } = await auth();
        if (!currentUserId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Ensure current user is super_admin
        await getOrCreateUser(currentUserId);
        const role = await getUserRoleFromDB(currentUserId);
        if (role !== "super_admin") {
            return NextResponse.json({ error: "Forbidden: Super admin only" }, { status: 403 });
        }

        const body = await request.json();
        const { role_id } = body;

        // Validate role_id
        if (!role_id || isNaN(parseInt(role_id))) {
            return NextResponse.json({ error: "Valid role_id is required" }, { status: 400 });
        }

        const { userId: targetUserId } = await params;

        // Check if target user exists
        const [targetUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, targetUserId))
            .limit(1);

        if (!targetUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Update user role
        const [updatedUser] = await db
            .update(users)
            .set({
                role_id: parseInt(role_id),
                updated_at: new Date(),
            })
            .where(eq(users.id, targetUserId))
            .returning();

        return NextResponse.json(
            {
                message: "User role updated successfully",
                user: updatedUser
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Update user role error:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to update user role";
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
