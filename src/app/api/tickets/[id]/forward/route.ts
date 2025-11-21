import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tickets, outbox, users, ticket_statuses, roles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";
import { TICKET_STATUS, isAdminLevel } from "@/conf/constants";

/**
 * ============================================
 * /api/tickets/[id]/forward
 * ============================================
 * 
 * POST → Forward Ticket to Another Admin
 *   - Auth: Required (Admin only)
 *   - Behavior:
 *     • Forwards ticket to specified admin
 *     • Sets status to FORWARDED
 *     • Triggers worker notifications
 *   - Returns: 200 OK with updated ticket
 * ============================================
 */

// Body schema for POST
// targetAdminId is OPTIONAL – if not provided, the API will auto-select
// the next-level admin (typically a super_admin).
const ForwardSchema = z.object({
    targetAdminId: z.string().optional(),
    reason: z.string().max(2000).optional(),
});

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // --------------------------------------------------
        // AUTH
        // --------------------------------------------------
        const { userId } = await auth();
        if (!userId)
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const localUser = await getOrCreateUser(userId);
        if (!localUser)
            return NextResponse.json({ error: "User not found" }, { status: 404 });

        const role = await getUserRoleFromDB(userId);

        // Only admin-level roles can forward tickets (admin, committee, super_admin)
        if (!isAdminLevel(role)) {
            return NextResponse.json(
                { error: "Only admins can forward tickets" },
                { status: 403 }
            );
        }

        // --------------------------------------------------
        // PARAMS
        // --------------------------------------------------
        const { id } = await params;
        const ticketId = Number(id);
        if (isNaN(ticketId))
            return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });

        const body = await request.json().catch(() => ({}));
        const parsed = ForwardSchema.safeParse(body);
        if (!parsed.success)
            return NextResponse.json(
                { error: "Invalid request", details: parsed.error.format() },
                { status: 400 }
            );

        let { targetAdminId } = parsed.data;
        const { reason } = parsed.data;

        // --------------------------------------------------
        // LOAD TICKET
        // --------------------------------------------------
        const [ticket] = await db
            .select({
                id: tickets.id,
                status_id: tickets.status_id,
                assigned_to: tickets.assigned_to,
                status_value: ticket_statuses.value,
            })
            .from(tickets)
            .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
            .where(eq(tickets.id, ticketId))
            .limit(1);

        if (!ticket)
            return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

        // Cannot forward resolved tickets
        if (ticket.status_value === TICKET_STATUS.RESOLVED) {
            return NextResponse.json(
                { error: "Cannot forward a resolved ticket" },
                { status: 400 }
            );
        }

        // --------------------------------------------------
        // RESOLVE TARGET ADMIN
        // --------------------------------------------------
        // If targetAdminId is not provided, auto-select a super admin as the
        // forwarding target (next-level admin).
        if (!targetAdminId) {
            const [superAdmin] = await db
                .select({
                    id: users.id,
                })
                .from(users)
                .innerJoin(roles, eq(users.role_id, roles.id))
                .where(eq(roles.name, "super_admin"))
                .limit(1);

            if (!superAdmin) {
                return NextResponse.json(
                    { error: "No super admin found to forward ticket to" },
                    { status: 400 }
                );
            }

            targetAdminId = superAdmin.id;
        }

        // --------------------------------------------------
        // GET TARGET ADMIN DETAILS
        // --------------------------------------------------
        const [targetAdmin] = await db
            .select({
                id: users.id,
                first_name: users.first_name,
                last_name: users.last_name,
                email: users.email,
            })
            .from(users)
            .where(eq(users.id, targetAdminId))
            .limit(1);

        if (!targetAdmin) {
            return NextResponse.json(
                { error: "Target admin not found" },
                { status: 404 }
            );
        }

        const targetAdminName = [targetAdmin.first_name, targetAdmin.last_name]
            .filter(Boolean)
            .join(' ')
            .trim() || "Unknown";

        // --------------------------------------------------
        // GET FORWARDED STATUS ID
        // --------------------------------------------------
        const [forwardedStatus] = await db.select({ id: ticket_statuses.id })
            .from(ticket_statuses)
            .where(eq(ticket_statuses.value, TICKET_STATUS.FORWARDED))
            .limit(1);

        if (!forwardedStatus) {
            return NextResponse.json({ error: "FORWARDED status not found in database" }, { status: 500 });
        }

        // --------------------------------------------------
        // UPDATE TICKET
        // --------------------------------------------------
        const updatedTicket = await db.transaction(async (tx) => {
            // Update ticket - reassign to target admin and set status to FORWARDED
            const [t] = await tx
                .update(tickets)
                .set({
                    assigned_to: targetAdmin.id,
                    status_id: forwardedStatus.id,
                    updated_at: new Date(),
                })
                .where(eq(tickets.id, ticketId))
                .returning();

            if (!t) throw new Error("Failed to update ticket during forwarding");

            // Insert outbox event for notifications
            await tx.insert(outbox).values({
                event_type: "ticket.forwarded",
                payload: {
                    ticket_id: ticketId,
                    forwarded_by_clerk_id: userId,
                    forwarded_by_role: role,
                    previous_assigned_to: ticket.assigned_to,
                    new_assigned_to: targetAdmin.id,
                    new_admin_name: targetAdminName,
                    new_admin_email: targetAdmin.email,
                    reason: reason || null,
                },
            });

            return t;
        });

        return NextResponse.json(
            {
                success: true,
                message: `Ticket forwarded to ${targetAdminName || targetAdmin.email}`,
                ticket: updatedTicket,
                forwardedTo: {
                    id: targetAdmin.id,
                    name: targetAdminName,
                    email: targetAdmin.email,
                },
            },
            { status: 200 }
        );
    } catch (err) {
        console.error("Error forwarding ticket:", err);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
