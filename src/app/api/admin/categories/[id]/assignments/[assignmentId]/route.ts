import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { category_assignments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";

/**
 * DELETE /api/admin/categories/[id]/assignments/[assignmentId]
 * Remove an admin assignment from a category
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const role = await getUserRoleFromDB(userId);
        if (role !== "super_admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { assignmentId } = await params;
        const id = parseInt(assignmentId);

        await db
            .delete(category_assignments)
            .where(eq(category_assignments.id, id));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Category Assignments API] Error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/admin/categories/[id]/assignments/[assignmentId]
 * Update an admin assignment (e.g., change primary status or priority)
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const role = await getUserRoleFromDB(userId);
        if (role !== "super_admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { id, assignmentId } = await params;
        const categoryId = parseInt(id);
        const assignId = parseInt(assignmentId);
        const body = await request.json();
        const { is_primary, priority } = body;

        // If setting as primary, unset other primary assignments
        if (is_primary) {
            await db
                .update(category_assignments)
                .set({ is_primary: false, updated_at: new Date() })
                .where(eq(category_assignments.category_id, categoryId));
        }

        const updated = await db
            .update(category_assignments)
            .set({
                is_primary: is_primary !== undefined ? is_primary : undefined,
                priority: priority !== undefined ? priority : undefined,
                updated_at: new Date(),
            })
            .where(eq(category_assignments.id, assignId))
            .returning();

        return NextResponse.json({ assignment: updated[0] });
    } catch (error) {
        console.error("[Category Assignments API] Error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
