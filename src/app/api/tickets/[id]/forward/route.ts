import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tickets, outbox, users, committees, ticket_statuses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCachedAdminUser, getCachedTicketStatuses } from "@/lib/cache/cached-queries";
import { TICKET_STATUS, getCanonicalStatus, isAdminLevel } from "@/conf/constants";
import { ForwardTicketSchema } from "@/schemas/business/ticket";
import type { TicketMetadata } from "@/db/inferred-types";

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

        // Use cached function for better performance (request-scoped deduplication)
        const { dbUser: localUser, role } = await getCachedAdminUser(userId);
        if (!localUser)
            return NextResponse.json({ error: "User not found" }, { status: 404 });

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
        const parsed = ForwardTicketSchema.safeParse(body);
        if (!parsed.success)
            return NextResponse.json(
                { error: "Invalid request", details: parsed.error.format() },
                { status: 400 }
            );

        const { committee_id, reason } = parsed.data;

        // --------------------------------------------------
        // LOAD TICKET
        // --------------------------------------------------
        const [ticket] = await db
            .select({
                id: tickets.id,
                status_id: tickets.status_id,
                status_value: ticket_statuses.value,
                assigned_to: tickets.assigned_to,
                metadata: tickets.metadata,
            })
            .from(tickets)
            .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
            .where(eq(tickets.id, ticketId))
            .limit(1);

        if (!ticket)
            return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

        // Cannot forward resolved tickets
        const currentStatus = getCanonicalStatus(ticket.status_value || "");
        if (currentStatus === TICKET_STATUS.RESOLVED) {
            return NextResponse.json(
                { error: "Cannot forward a resolved ticket" },
                { status: 400 }
            );
        }

        // --------------------------------------------------
        // GET COMMITTEE AND HEAD (optimized single query with join)
        // --------------------------------------------------
        const [committeeWithHead] = await db
            .select({
                committee_id: committees.id,
                committee_name: committees.name,
                head_id: committees.head_id,
                head_user_id: users.id,
                head_full_name: users.full_name,
                head_email: users.email,
            })
            .from(committees)
            .leftJoin(users, eq(committees.head_id, users.id))
            .where(eq(committees.id, committee_id))
            .limit(1);

        if (!committeeWithHead) {
            return NextResponse.json(
                { error: "Committee not found" },
                { status: 404 }
            );
        }

        if (!committeeWithHead.head_id) {
            return NextResponse.json(
                { error: "Committee has no head assigned" },
                { status: 400 }
            );
        }

        if (!committeeWithHead.head_user_id) {
            return NextResponse.json(
                { error: "Committee head not found" },
                { status: 404 }
            );
        }

        const targetAdmin = {
            id: committeeWithHead.head_user_id,
            full_name: committeeWithHead.head_full_name,
            email: committeeWithHead.head_email,
        };
        const targetAdminName = targetAdmin.full_name?.trim() || targetAdmin.email || "Unknown";

        // --------------------------------------------------
        // UPDATE TICKET
        // --------------------------------------------------
        const updatedTicket = await db.transaction(async (tx) => {
            // Parse and update metadata to track forwarding count
            let metadata: TicketMetadata = {};
            if (ticket.metadata) {
                try {
                    metadata = typeof ticket.metadata === 'string' 
                        ? JSON.parse(ticket.metadata) as TicketMetadata
                        : ticket.metadata as TicketMetadata;
                } catch {
                    // Ignore parse errors, start with empty metadata
                }
            }
            
            // Increment forward count for "ping-pong" forwarding detection
            const currentForwardCount = (metadata.forwardCount as number) || 0;
            metadata.forwardCount = currentForwardCount + 1;
            
            // Get status ID for FORWARDED status using cached statuses
            const ticketStatuses = await getCachedTicketStatuses();
            const forwardedStatus = ticketStatuses.find(s => s.value.toLowerCase() === TICKET_STATUS.FORWARDED.toLowerCase());
            if (!forwardedStatus?.id) {
                throw new Error("FORWARDED status not found in database");
            }
            const forwardedStatusId = forwardedStatus.id;
            
            // Update ticket - reassign to committee head and set status to FORWARDED
            const [t] = await tx
                .update(tickets)
                .set({
                    assigned_to: targetAdmin.id,
                    status_id: forwardedStatusId,
                    updated_at: new Date(),
                    metadata: metadata as unknown,
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
