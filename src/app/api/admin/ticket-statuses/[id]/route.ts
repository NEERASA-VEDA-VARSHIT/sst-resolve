import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { ticket_statuses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { canDeleteStatus } from "@/lib/status/getTicketStatuses";
import { revalidateTag } from "next/cache";

// GET /api/admin/ticket-statuses/[id] - Fetch single status
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
        if (role !== "super_admin") {
            return NextResponse.json({ error: "Forbidden - Super admin only" }, { status: 403 });
        }

        const { id } = await params;
        const statusId = parseInt(id);

        if (isNaN(statusId)) {
            return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
        }

        const [status] = await db
            .select()
            .from(ticket_statuses)
            .where(eq(ticket_statuses.id, statusId))
            .limit(1);

        if (!status) {
            return NextResponse.json({ success: false, error: "Status not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: status });
    } catch (error) {
        console.error("[API /ticket-statuses/[id] GET] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch status" },
            { status: 500 }
        );
    }
}

// PATCH /api/admin/ticket-statuses/[id] - Update status
export async function PATCH(
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
            return NextResponse.json({ error: "Forbidden - Super admin only" }, { status: 403 });
        }

        const { id } = await params;
        const statusId = parseInt(id);

        if (isNaN(statusId)) {
            return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
        }

        const body = await request.json();
        const { label, description, progress_percent, badge_color, is_active, is_final, display_order } = body;

        // Check if status exists
        const [existing] = await db
            .select()
            .from(ticket_statuses)
            .where(eq(ticket_statuses.id, statusId))
            .limit(1);

        if (!existing) {
            return NextResponse.json({ success: false, error: "Status not found" }, { status: 404 });
        }

        // Validate progress_percent if provided
        if (progress_percent !== undefined && (progress_percent < 0 || progress_percent > 100)) {
            return NextResponse.json(
                { success: false, error: "Progress percent must be between 0 and 100" },
                { status: 400 }
            );
        }

        // Update status
        const [updated] = await db
            .update(ticket_statuses)
            .set({
                label: label !== undefined ? label : existing.label,
                description: description !== undefined ? description : existing.description,
                progress_percent: progress_percent !== undefined ? progress_percent : existing.progress_percent,
                badge_color: badge_color !== undefined ? badge_color : existing.badge_color,
                is_active: is_active !== undefined ? is_active : existing.is_active,
                is_final: is_final !== undefined ? is_final : existing.is_final,
                display_order: display_order !== undefined ? display_order : existing.display_order,
                updated_at: new Date(),
            })
            .where(eq(ticket_statuses.id, statusId))
            .returning();

        // Invalidate cache
        revalidateTag("ticket-statuses");

        return NextResponse.json({ success: true, data: updated });
    } catch (error) {
        console.error("[API /ticket-statuses/[id] PATCH] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to update status" },
            { status: 500 }
        );
    }
}

// DELETE /api/admin/ticket-statuses/[id] - Delete status
export async function DELETE(
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
            return NextResponse.json({ error: "Forbidden - Super admin only" }, { status: 403 });
        }

        const { id } = await params;
        const statusId = parseInt(id);

        if (isNaN(statusId)) {
            return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
        }

        // Check if status can be deleted
        const { canDelete, ticketCount } = await canDeleteStatus(statusId);

        if (!canDelete) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Cannot delete status: ${ticketCount} ticket(s) are using this status`,
                    details: { ticketCount },
                },
                { status: 400 }
            );
        }

        // Delete status
        await db.delete(ticket_statuses).where(eq(ticket_statuses.id, statusId));

        // Invalidate cache
        revalidateTag("ticket-statuses");

        return NextResponse.json({ success: true, message: "Status deleted successfully" });
    } catch (error) {
        console.error("[API /ticket-statuses/[id] DELETE] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to delete status" },
            { status: 500 }
        );
    }
}
