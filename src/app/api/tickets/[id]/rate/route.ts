import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, tickets } from "@/db";
import { eq } from "drizzle-orm";
import { RateTicketSchema } from "@/schema/ticket.schema";

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { userId, sessionClaims } = await auth();
		
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
				{ error: "Validation failed", details: validationResult.error.errors },
				{ status: 400 }
			);
		}
		
		const { rating: ratingNum } = validationResult.data;

		// Get current ticket
		const [ticket] = await db
			.select()
			.from(tickets)
			.where(eq(tickets.id, ticketId))
			.limit(1);

		if (!ticket) {
			return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
		}

		// Check if user owns this ticket
		const userNumber = sessionClaims?.metadata?.userNumber as string | undefined;
		if (!userNumber || ticket.userNumber !== userNumber) {
			return NextResponse.json({ error: "You can only rate your own tickets" }, { status: 403 });
		}

		// Check if ticket is closed/resolved
		if (ticket.status !== "closed" && ticket.status !== "resolved") {
			return NextResponse.json({ error: "You can only rate closed or resolved tickets" }, { status: 400 });
		}

		// Check if already rated
		if (ticket.rating) {
			return NextResponse.json({ error: "This ticket has already been rated" }, { status: 400 });
		}

		// Update ticket with rating
		await db
			.update(tickets)
			.set({
				rating: ratingNum.toString(),
				ratingSubmitted: new Date(),
				ratingRequired: "false", // Clear the requirement after rating
				updatedAt: new Date(),
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

