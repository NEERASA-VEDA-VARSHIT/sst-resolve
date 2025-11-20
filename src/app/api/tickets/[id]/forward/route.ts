import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tickets, outbox, staff, users } from "@/db/schema";
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
const ForwardSchema = z.object({
    targetAdminId: z.number(), // Required: admin to forward to
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

        const { targetAdminId, reason } = parsed.data;

        // --------------------------------------------------
        // LOAD TICKET
        // --------------------------------------------------
        const [ticket] = await db
            .select()
            .from(tickets)
            .where(eq(tickets.id, ticketId))
            .limit(1);

        if (!ticket)
            return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

        // Cannot forward resolved tickets
        if (ticket.status === TICKET_STATUS.RESOLVED) {
            return NextResponse.json(
                { error: "Cannot forward a resolved ticket" },
                { status: 400 }
            );
        }

        // --------------------------------------------------
        // GET TARGET ADMIN
        // --------------------------------------------------
        const [targetAdmin] = await db
            .select({
                id: staff.id,
                user_id: staff.user_id,
                domain: staff.domain,
                scope: staff.scope,
                full_name: staff.full_name,
                email: users.email,
            })
            .from(staff)
            .innerJoin(users, eq(staff.user_id, users.id))
            .where(eq(staff.id, targetAdminId))
            .limit(1);

        if (!targetAdmin) {
            return NextResponse.json(
                { error: "Target admin not found" },
                { status: 404 }
            );
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
                    status: TICKET_STATUS.FORWARDED,
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
                    new_admin_name: targetAdmin.full_name,
                    new_admin_email: targetAdmin.email,
                    reason: reason || null,
                },
            });

            return t;
        });

        return NextResponse.json(
            {
                success: true,
                message: `Ticket forwarded to ${targetAdmin.full_name || targetAdmin.email}`,
                ticket: updatedTicket,
                forwardedTo: {
                    id: targetAdmin.id,
                    name: targetAdmin.full_name,
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
