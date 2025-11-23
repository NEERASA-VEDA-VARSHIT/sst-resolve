import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, category_assignments, users } from "@/db";
import { eq, and, desc } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";

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

        // Fetch assignments with user info (removed staff reference)
        const assignmentsList = await db
            .select({
                id: category_assignments.id,
                category_id: category_assignments.category_id,
                user_id: category_assignments.user_id,
                is_primary: category_assignments.is_primary,
                priority: category_assignments.priority,
                created_at: category_assignments.created_at,
                updated_at: category_assignments.updated_at,
                user: {
                    id: users.id,
                    email: users.email,
                    first_name: users.first_name,
                    last_name: users.last_name,
                    clerk_id: users.clerk_id,
                },
            })
            .from(category_assignments)
            .leftJoin(users, eq(category_assignments.user_id, users.id))
            .where(eq(category_assignments.category_id, categoryId))
            .orderBy(desc(category_assignments.is_primary), desc(category_assignments.priority));

        return NextResponse.json({ assignments: assignmentsList });
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
        const { user_id, is_primary, priority } = body;

        if (!user_id) {
            return NextResponse.json(
                { error: "user_id is required" },
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
        const [existing] = await db
            .select()
            .from(category_assignments)
            .where(and(
                eq(category_assignments.category_id, categoryId),
                eq(category_assignments.user_id, user_id)
            ))
            .limit(1);

        if (existing) {
            return NextResponse.json(
                { error: "This admin is already assigned to this category" },
                { status: 400 }
            );
        }

        const [assignment] = await db
            .insert(category_assignments)
            .values({
                category_id: categoryId,
                user_id,
                is_primary: is_primary || false,
                priority: priority || 0,
            })
            .returning();

        return NextResponse.json({ assignment });
    } catch (error) {
        console.error("[Category Assignments API] Error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
