import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, tickets, ticket_statuses } from "@/db";
import { eq } from "drizzle-orm";
import { RateTicketSchema } from "@/schema/ticket.schema";

/**
 * ============================================
 * /api/tickets/[id]/rate
 * ============================================
 * 
 * POST → Student Rating
 *   - Auth: Required (Student only - own tickets)
 *   - Submit rating after ticket resolution
 *   - Body: { rating: number (1-5), feedback: string (optional) }
 *   - Returns: 200 OK with updated ticket
 * ============================================
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

		const { id } = await params;
		const ticketId = parseInt(id);
		
		if (isNaN(ticketId)) {
			return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
		}

		const body = await request.json();
		
		// Validate input using Zod schema
		const validationResult = RateTicketSchema.safeParse(body);
		if (!validationResult.success) {
			return NextResponse.json(
				{ error: "Validation failed", details: validationResult.error.issues },
				{ status: 400 }
			);
		}
		
		const { rating: ratingNum } = validationResult.data;

		// Get current user from database
		const { getOrCreateUser } = await import("@/lib/user-sync");
		const dbUser = await getOrCreateUser(userId);
		if (!dbUser) {
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		// Get current ticket with status join
		const [ticketRow] = await db
			.select({
				id: tickets.id,
				title: tickets.title,
				description: tickets.description,
				location: tickets.location,
				status_id: tickets.status_id,
				category_id: tickets.category_id,
				subcategory_id: tickets.subcategory_id,
				sub_subcategory_id: tickets.sub_subcategory_id,
				created_by: tickets.created_by,
				assigned_to: tickets.assigned_to,
				acknowledged_by: tickets.acknowledged_by,
				group_id: tickets.group_id,
				escalation_level: tickets.escalation_level,
				tat_extended_count: tickets.tat_extended_count,
				last_escalation_at: tickets.last_escalation_at,
				acknowledgement_tat_hours: tickets.acknowledgement_tat_hours,
				resolution_tat_hours: tickets.resolution_tat_hours,
				acknowledgement_due_at: tickets.acknowledgement_due_at,
				resolution_due_at: tickets.resolution_due_at,
				acknowledged_at: tickets.acknowledged_at,
				reopened_at: tickets.reopened_at,
				sla_breached_at: tickets.sla_breached_at,
				reopen_count: tickets.reopen_count,
				rating: tickets.rating,
				feedback_type: tickets.feedback_type,
				rating_submitted: tickets.rating_submitted,
				feedback: tickets.feedback,
				is_public: tickets.is_public,
				admin_link: tickets.admin_link,
				student_link: tickets.student_link,
				slack_thread_id: tickets.slack_thread_id,
				external_ref: tickets.external_ref,
				metadata: tickets.metadata,
				created_at: tickets.created_at,
				updated_at: tickets.updated_at,
				resolved_at: tickets.resolved_at,
				status_value: ticket_statuses.value,
			})
			.from(tickets)
			.leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
			.where(eq(tickets.id, ticketId))
			.limit(1);

		if (!ticketRow) {
			return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
		}

		const ticket = {
			...ticketRow,
			status: ticketRow.status_value || null,
		};

		// Check if user owns this ticket
		if (ticket.created_by !== dbUser.id) {
			return NextResponse.json({ error: "You can only rate your own tickets" }, { status: 403 });
		}

		// Check if ticket is closed/resolved
		const statusLower = (ticket.status || "").toLowerCase();
		if (statusLower !== "closed" && statusLower !== "resolved") {
			return NextResponse.json({ error: "You can only rate closed or resolved tickets" }, { status: 400 });
		}

		// Check if already rated
		if (ticket.rating) {
			return NextResponse.json({ error: "This ticket has already been rated" }, { status: 400 });
		}

		// Update ticket with rating (rating is integer, not string)
		await db
			.update(tickets)
			.set({
				rating: ratingNum,
				rating_submitted: new Date(),
				updated_at: new Date(),
			})
			.where(eq(tickets.id, ticketId));

		return NextResponse.json({ 
			success: true, 
			message: "Rating submitted successfully",
			rating: ratingNum,
		});
	} catch (error) {
		console.error("Error submitting rating:", error);
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}

