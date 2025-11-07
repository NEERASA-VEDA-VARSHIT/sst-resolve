import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, tickets } from "@/db";
import { eq } from "drizzle-orm";

/**
 * PATCH - Toggle public/private status of a ticket (admin only)
 */
export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { userId, sessionClaims } = await auth();
		
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Check if user is admin
		const role = sessionClaims?.metadata?.role;
		if (role !== "admin" && role !== "super_admin") {
			return NextResponse.json({ error: "Only admins can make tickets public" }, { status: 403 });
		}

		const { id } = await params;
		const ticketId = parseInt(id);
		
		if (isNaN(ticketId)) {
			return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
		}

		const body = await request.json();
		const { isPublic } = body;

		if (typeof isPublic !== "boolean") {
			return NextResponse.json({ error: "isPublic must be a boolean" }, { status: 400 });
		}

		// Get current ticket
		const [ticket] = await db
			.select()
			.from(tickets)
			.where(eq(tickets.id, ticketId))
			.limit(1);

		if (!ticket) {
			return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
		}

		// Update ticket public status
		const [updatedTicket] = await db
			.update(tickets)
			.set({ 
				isPublic: isPublic ? "true" : "false",
				updatedAt: new Date()
			})
			.where(eq(tickets.id, ticketId))
			.returning();

		return NextResponse.json({ 
			success: true, 
			isPublic: updatedTicket.isPublic === "true",
			message: isPublic ? "Ticket made public" : "Ticket made private"
		});
	} catch (error) {
		console.error("Error updating ticket public status:", error);
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}

