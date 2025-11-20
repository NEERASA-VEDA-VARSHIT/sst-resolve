import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { category_assignments, staff } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";

/**
 * GET /api/admin/categories/[id]/assignments
 * Get all admin assignments for a category
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const role = await getUserRoleFromDB(userId);
        if (role !== "super_admin" && role !== "admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { id } = await params;
        const categoryId = parseInt(id);

        const assignments = await db.query.category_assignments.findMany({
            where: eq(category_assignments.category_id, categoryId),
            with: {
                staff: {
                    with: {
                        user: true,
                    },
                },
            },
            orderBy: [
                desc(category_assignments.is_primary),
                desc(category_assignments.priority),
            ],
        });

        return NextResponse.json({ assignments });
    } catch (error) {
        console.error("[Category Assignments API] Error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/admin/categories/[id]/assignments
 * Add a new admin assignment to a category
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
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

        const { id } = await params;
        const categoryId = parseInt(id);
        const body = await request.json();
        const { staff_id, is_primary, priority } = body;

        if (!staff_id) {
            return NextResponse.json(
                { error: "staff_id is required" },
                { status: 400 }
            );
        }

        // If setting as primary, unset other primary assignments for this category
        if (is_primary) {
            await db
                .update(category_assignments)
                .set({ is_primary: false, updated_at: new Date() })
                .where(eq(category_assignments.category_id, categoryId));
        }

        // Check if assignment already exists
        const existing = await db.query.category_assignments.findFirst({
            where: and(
                eq(category_assignments.category_id, categoryId),
                eq(category_assignments.staff_id, staff_id)
            ),
        });

        if (existing) {
            return NextResponse.json(
                { error: "This admin is already assigned to this category" },
                { status: 400 }
            );
        }

        const assignment = await db
            .insert(category_assignments)
            .values({
                category_id: categoryId,
                staff_id,
                is_primary: is_primary || false,
                priority: priority || 0,
            })
            .returning();

        return NextResponse.json({ assignment: assignment[0] });
    } catch (error) {
        console.error("[Category Assignments API] Error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
