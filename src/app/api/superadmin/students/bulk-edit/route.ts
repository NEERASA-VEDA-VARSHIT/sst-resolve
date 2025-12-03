import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { students } from "@/db/schema";
import type { StudentInsert } from "@/db/inferred-types";
import { inArray } from "drizzle-orm";
import { getCachedAdminUser } from "@/lib/cache/cached-queries";
import { BulkEditStudentsSchema } from "@/schemas/business/student";

/**
 * PATCH /api/superadmin/students/bulk-edit
 * Update multiple students at once with the same field values
 * Only super admins can access this endpoint
 */

export async function PATCH(request: NextRequest) {
    try {
        // Auth check
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Use cached function for better performance (request-scoped deduplication)
        const { role } = await getCachedAdminUser(userId);
        if (role !== "super_admin") {
            return NextResponse.json(
                { error: "Only super admins can bulk edit students" },
                { status: 403 }
            );
        }

        // Parse request body
        const body = await request.json();
        const parsed = BulkEditStudentsSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid request data", details: parsed.error.format() },
                { status: 400 }
            );
        }

        const { student_ids, updates } = parsed.data;

        // Check if there are any updates to apply
        const hasUpdates = Object.values(updates).some((value) => value !== undefined);
        if (!hasUpdates) {
            return NextResponse.json(
                { error: "No updates provided" },
                { status: 400 }
            );
        }

        // Verify all students exist
        const existingStudents = await db
            .select({ id: students.id })
            .from(students)
            .where(inArray(students.id, student_ids));

        if (existingStudents.length !== student_ids.length) {
            return NextResponse.json(
                { error: "Some students not found" },
                { status: 404 }
            );
        }

        // Perform bulk update
        const updateData: Partial<StudentInsert> = {
            ...updates,
            updated_at: new Date(),
        };

        // Remove undefined values
        Object.keys(updateData).forEach((key) => {
            if (updateData[key as keyof typeof updateData] === undefined) {
                delete updateData[key as keyof typeof updateData];
            }
        });

        const updatedStudents = await db
            .update(students)
            .set(updateData)
            .where(inArray(students.id, student_ids))
            .returning();

        return NextResponse.json({
            success: true,
            message: `Successfully updated ${updatedStudents.length} students`,
            updated_count: updatedStudents.length,
            student_ids: student_ids,
        });
    } catch (error) {
        console.error("Error bulk editing students:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
