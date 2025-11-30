import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, tickets } from "@/db";
import { ticket_statuses } from "@/db/schema";
import type { TicketInsert } from "@/db/inferred-types";
import { eq } from "drizzle-orm";
import { RateTicketSchema } from "@/schemas/business/ticket";

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
		
		const { rating: ratingNum, feedback } = validationResult.data;

		// Get current user from database
		const { getOrCreateUser } = await import("@/lib/auth/user-sync");
		const dbUser = await getOrCreateUser(userId);
		if (!dbUser) {
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		// Get current ticket
		const [ticketRow] = await db
			.select({
				id: tickets.id,
				title: tickets.title,
				description: tickets.description,
				location: tickets.location,
				status_id: tickets.status_id,
				status_value: ticket_statuses.value,
				category_id: tickets.category_id,
				subcategory_id: tickets.subcategory_id,
				sub_subcategory_id: tickets.sub_subcategory_id,
				created_by: tickets.created_by,
				assigned_to: tickets.assigned_to,
				group_id: tickets.group_id,
				escalation_level: tickets.escalation_level,
				acknowledgement_due_at: tickets.acknowledgement_due_at,
				resolution_due_at: tickets.resolution_due_at,
				metadata: tickets.metadata,
				created_at: tickets.created_at,
				updated_at: tickets.updated_at,
			})
			.from(tickets)
			.leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
			.where(eq(tickets.id, ticketId))
			.limit(1);

		if (!ticketRow) {
			return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
		}

		// Check if user owns this ticket
		if (ticketRow.created_by !== dbUser.id) {
			return NextResponse.json({ error: "You can only rate your own tickets" }, { status: 403 });
		}

		// Check if ticket is closed/resolved
		const statusLower = (ticketRow.status_value || "").toLowerCase();
		if (statusLower !== "closed" && statusLower !== "resolved") {
			return NextResponse.json({ error: "You can only rate closed or resolved tickets" }, { status: 400 });
		}

		// Parse metadata to check if already rated
		let metadata: Record<string, unknown> = {};
		if (ticketRow.metadata && typeof ticketRow.metadata === 'object' && !Array.isArray(ticketRow.metadata)) {
			metadata = { ...ticketRow.metadata as Record<string, unknown> };
		}

		// Check if already rated
		if (metadata.rating_submitted) {
			return NextResponse.json({ error: "This ticket has already been rated" }, { status: 400 });
		}

		// Update metadata with rating
		metadata.rating = ratingNum;
		metadata.rating_submitted = new Date().toISOString();
		if (feedback) {
			metadata.feedback = feedback;
		}

		// Update ticket with rating in metadata
		const updateData: Partial<TicketInsert> = {
			metadata: metadata as unknown,
			updated_at: new Date(),
		};
		
		await db
			.update(tickets)
			.set(updateData)
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

