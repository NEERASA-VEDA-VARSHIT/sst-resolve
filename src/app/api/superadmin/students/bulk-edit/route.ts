import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { students } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { z } from "zod";
import { getUserRoleFromDB } from "@/lib/db-roles";

/**
 * PATCH /api/superadmin/students/bulk-edit
 * Update multiple students at once with the same field values
 * Only super admins can access this endpoint
 */

const BulkEditSchema = z.object({
    student_ids: z.array(z.number()).min(1, "At least one student must be selected"),
    updates: z.object({
        hostel_id: z.number().nullable().optional(),
        batch_id: z.number().nullable().optional(),
        class_section_id: z.number().nullable().optional(),
        batch_year: z.number().nullable().optional(),
        department: z.string().max(120).nullable().optional(),
    }),
});

export async function PATCH(request: NextRequest) {
    try {
        // Auth check
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Role check - only super admin
        const role = await getUserRoleFromDB(userId);
        if (role !== "super_admin") {
            return NextResponse.json(
                { error: "Only super admins can bulk edit students" },
                { status: 403 }
            );
        }

        // Parse request body
        const body = await request.json();
        const parsed = BulkEditSchema.safeParse(body);
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
        const updateData: Record<string, unknown> = {
            ...updates,
            updated_at: new Date(),
        };

        // Remove undefined values
        Object.keys(updateData).forEach((key) => {
            if (updateData[key] === undefined) {
                delete updateData[key];
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
