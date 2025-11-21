import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { ticket_statuses } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";
import { revalidateTag } from "next/cache";

// GET /api/admin/ticket-statuses - Fetch all statuses (including inactive)
export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check if user is super-admin
        const role = await getUserRoleFromDB(userId);
        if (role !== "super_admin") {
            return NextResponse.json({ error: "Forbidden - Super admin only" }, { status: 403 });
        }

        // Fetch all statuses (including inactive)
        const statuses = await db
            .select()
            .from(ticket_statuses)
            .orderBy(asc(ticket_statuses.display_order));

        return NextResponse.json({ success: true, data: statuses });
    } catch (error) {
        console.error("[API /ticket-statuses GET] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch statuses" },
            { status: 500 }
        );
    }
}

// POST /api/admin/ticket-statuses - Create new status
export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check if user is super-admin
        const role = await getUserRoleFromDB(userId);
        if (role !== "super_admin") {
            return NextResponse.json({ error: "Forbidden - Super admin only" }, { status: 403 });
        }

        const body = await request.json();
        const { value, label, description, progress_percent, badge_color, is_active, is_final, display_order } = body;

        // Validation
        if (!value || !label) {
            return NextResponse.json(
                { success: false, error: "Value and label are required" },
                { status: 400 }
            );
        }

        // Validate value format (uppercase, no spaces)
        if (!/^[A-Z_]+$/.test(value)) {
            return NextResponse.json(
                { success: false, error: "Value must be uppercase letters and underscores only" },
                { status: 400 }
            );
        }

        // Validate progress_percent (0-100)
        if (progress_percent !== undefined && (progress_percent < 0 || progress_percent > 100)) {
            return NextResponse.json(
                { success: false, error: "Progress percent must be between 0 and 100" },
                { status: 400 }
            );
        }

        // Check if value already exists
        const [existing] = await db
            .select()
            .from(ticket_statuses)
            .where(eq(ticket_statuses.value, value))
            .limit(1);

        if (existing) {
            return NextResponse.json(
                { success: false, error: "Status with this value already exists" },
                { status: 400 }
            );
        }

        // Auto-assign next display_order if not provided
        let finalDisplayOrder = display_order;
        if (finalDisplayOrder === undefined) {
            const [maxOrder] = await db
                .select({ max: db.fn.max(ticket_statuses.display_order) })
                .from(ticket_statuses);
            finalDisplayOrder = (maxOrder?.max || 0) + 1;
        }

        // Insert new status
        const [newStatus] = await db
            .insert(ticket_statuses)
            .values({
                value,
                label,
                description: description || null,
                progress_percent: progress_percent || 0,
                badge_color: badge_color || "default",
                is_active: is_active !== undefined ? is_active : true,
                is_final: is_final || false,
                display_order: finalDisplayOrder,
            })
            .returning();

        // Invalidate cache
        revalidateTag("ticket-statuses");

        return NextResponse.json({ success: true, data: newStatus }, { status: 201 });
    } catch (error) {
        console.error("[API /ticket-statuses POST] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to create status" },
            { status: 500 }
        );
    }
}
