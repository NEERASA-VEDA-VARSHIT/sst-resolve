import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { category_assignments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";

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

        const { id: categoryIdStr, assignmentId } = await params;
        const categoryId = parseInt(categoryIdStr);
        const assignmentIdNum = parseInt(assignmentId);
        
        if (isNaN(categoryId) || categoryId <= 0) {
            return NextResponse.json({ error: "Invalid category ID" }, { status: 400 });
        }
        
        if (isNaN(assignmentIdNum) || assignmentIdNum <= 0) {
            return NextResponse.json({ error: "Invalid assignment ID" }, { status: 400 });
        }

        await db
            .delete(category_assignments)
            .where(eq(category_assignments.id, assignmentIdNum));

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

        const { id: categoryIdStr, assignmentId } = await params;
        const categoryId = parseInt(categoryIdStr);
        const assignmentIdNum = parseInt(assignmentId);
        
        if (isNaN(categoryId) || categoryId <= 0) {
            return NextResponse.json({ error: "Invalid category ID" }, { status: 400 });
        }
        
        if (isNaN(assignmentIdNum) || assignmentIdNum <= 0) {
            return NextResponse.json({ error: "Invalid assignment ID" }, { status: 400 });
        }
        
        const body = await request.json();
        const { assignment_type } = body;

        const updateData: { assignment_type?: string | null } = {};
        if (assignment_type !== undefined) {
            updateData.assignment_type = assignment_type || null;
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json(
                { error: "No fields to update" },
                { status: 400 }
            );
        }

        const updated = await db
            .update(category_assignments)
            .set(updateData)
            .where(eq(category_assignments.id, assignmentIdNum))
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
