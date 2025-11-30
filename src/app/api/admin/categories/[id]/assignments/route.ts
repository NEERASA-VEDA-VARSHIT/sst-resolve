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
        
        if (isNaN(categoryId) || categoryId <= 0) {
            return NextResponse.json({ error: "Invalid category ID" }, { status: 400 });
        }

        // Fetch assignments with user info
        const assignmentsList = await db
            .select({
                id: category_assignments.id,
                category_id: category_assignments.category_id,
                user_id: category_assignments.user_id,
                assignment_type: category_assignments.assignment_type,
                created_at: category_assignments.created_at,
                user: {
                    id: users.id,
                    email: users.email,
                    full_name: users.full_name,
                    external_id: users.external_id,
                },
            })
            .from(category_assignments)
            .leftJoin(users, eq(category_assignments.user_id, users.id))
            .where(eq(category_assignments.category_id, categoryId))
            .orderBy(desc(category_assignments.created_at));

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
        
        if (isNaN(categoryId) || categoryId <= 0) {
            return NextResponse.json({ error: "Invalid category ID" }, { status: 400 });
        }
        
        const body = await request.json();
        const { user_id, assignment_type } = body;

        if (!user_id || typeof user_id !== 'string') {
            return NextResponse.json(
                { error: "user_id (UUID) is required" },
                { status: 400 }
            );
        }

        // Validate user_id is a valid UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(user_id)) {
            return NextResponse.json(
                { error: "user_id must be a valid UUID" },
                { status: 400 }
            );
        }

        // Check if user exists
        const [userExists] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, user_id))
            .limit(1);

        if (!userExists) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
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
                assignment_type: assignment_type || null,
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
