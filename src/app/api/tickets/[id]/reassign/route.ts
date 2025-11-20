import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, tickets } from "@/db";
import { eq } from "drizzle-orm";
import { postThreadReply } from "@/lib/slack";
import { sendEmail, getStudentEmail } from "@/lib/email";
import { ReassignTicketSchema } from "@/schema/ticket.schema";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";

/**
 * ============================================
 * /api/tickets/[id]/reassign
 * ============================================
 * 
 * POST → Reassign Ticket
 *   - Auth: Required (Admin only)
 *   - Reassign ticket to different staff member
 *   - Body: { staffId: string (UUID), reason: string (optional) }
 *   - Notifies both old and new assignee
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

		// Ensure user exists in database
		await getOrCreateUser(userId);

		// Get role from database (single source of truth)
		const role = await getUserRoleFromDB(userId);
		const isAdmin = role === "admin" || role === "super_admin";
		
		if (!isAdmin) {
			return NextResponse.json({ error: "Only admins can reassign tickets" }, { status: 403 });
		}

		const { id } = await params;
		const ticketId = parseInt(id);
		
		if (isNaN(ticketId)) {
			return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
		}

		const body = await request.json();
		
		// Validate input using Zod schema
		const validationResult = ReassignTicketSchema.safeParse(body);
		if (!validationResult.success) {
			return NextResponse.json(
				{ error: "Validation failed", details: validationResult.error.errors },
				{ status: 400 }
			);
		}
		
		const { assignedTo } = validationResult.data;
		const normalizedAssignedTo = assignedTo === "unassigned" ? null : assignedTo;
 
		// Get current ticket
		const [ticket] = await db
			.select()
			.from(tickets)
			.where(eq(tickets.id, ticketId))
			.limit(1);

		if (!ticket) {
			return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
		}

		// Parse existing details
		let details: any = {};
		let originalMessageId: string | undefined;
		let originalSubject: string | undefined;
		if (ticket.details) {
			try {
				details = JSON.parse(ticket.details);
				originalMessageId = details.originalEmailMessageId;
				originalSubject = details.originalEmailSubject;
			} catch (e) {
				console.error("Error parsing details:", e);
			}
		}

		// Validate new assignee against domain/scope assignment
		let adminName = "Admin";
		if (normalizedAssignedTo) {
			const { getAdminAssignment, ticketMatchesAdminAssignment } = await import("@/lib/admin-assignment");
			const targetAssignment = await getAdminAssignment(normalizedAssignedTo);
			if (!targetAssignment.domain) {
				return NextResponse.json({ error: "Selected admin does not have a domain assignment" }, { status: 400 });
			}
			const matchesAssignment = ticketMatchesAdminAssignment(
				{ category: ticket.category, location: ticket.location },
				targetAssignment
			);
			if (!matchesAssignment) {
				return NextResponse.json({ error: "Selected admin is not authorized for this ticket's domain" }, { status: 400 });
			}
			try {
				const { clerkClient } = await import("@clerk/nextjs/server");
				const client = await clerkClient();
				const user = await client.users.getUser(normalizedAssignedTo);
				adminName = user.firstName && user.lastName 
					? `${user.firstName} ${user.lastName}`
					: user.emailAddresses[0]?.emailAddress || "Admin";
			} catch (e) {
				console.error("Error fetching admin name:", e);
			}
		} else {
			adminName = "Unassigned";
		}

		// Update ticket
		await db
			.update(tickets)
			.set({
				assignedTo: normalizedAssignedTo,
				updatedAt: new Date(),
			})
			.where(eq(tickets.id, ticketId));

		// Send Slack notification
		if (ticket.category === "Hostel" || ticket.category === "College") {
			const slackMessageTs = details.slackMessageTs;
			if (slackMessageTs) {
				try {
					const reassignText = normalizedAssignedTo
						? `🔄 *Ticket Reassigned*\nTicket #${ticketId} has been reassigned to ${adminName}.\nPrevious assignment: ${ticket.assignedTo || "Unassigned"}`
						: `🔄 *Ticket Unassigned*\nTicket #${ticketId} is now unassigned.\nPrevious assignment: ${ticket.assignedTo || "Unassigned"}`;
					await postThreadReply(
						ticket.category as "Hostel" | "College",
						slackMessageTs,
						reassignText
					);
					console.log(`✅ Posted reassignment to Slack thread for ticket #${ticketId}`);
				} catch (slackError) {
					console.error(`❌ Error posting reassignment to Slack for ticket #${ticketId}:`, slackError);
				}
			}
		}

		// Send email notification to student
		try {
			const studentEmail = await getStudentEmail(ticket.userNumber);
			if (studentEmail) {
				const emailTemplate = normalizedAssignedTo
					? {
						subject: `Re: Ticket #${ticketId} Reassigned`,
						html: `
						<!DOCTYPE html>
						<html>
						<head>
							<style>
								body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
								.container { max-width: 600px; margin: 0 auto; padding: 20px; }
								.header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
								.content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
								.info-box { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #4F46E5; }
								.footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
							</style>
						</head>
						<body>
							<div class="container">
								<div class="header">
									<h1>🔄 Ticket Reassigned</h1>
								</div>
								<div class="content">
									<p>Your ticket has been reassigned to ensure prompt attention.</p>
									<div class="info-box">
										<p><strong>Ticket ID:</strong> #${ticketId}</p>
										<p><strong>Category:</strong> ${ticket.category}</p>
										<p><strong>Assigned To:</strong> ${adminName}</p>
										<p>Your ticket will be handled by the new assignee.</p>
									</div>
								</div>
								<div class="footer">
									<p>This is an automated email from SST Resolve</p>
								</div>
							</div>
						</body>
						</html>
					`,
				}
					: {
						subject: `Re: Ticket #${ticketId} Update`,
						html: `
						<!DOCTYPE html>
						<html>
						<head>
							<style>
								body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
								.container { max-width: 600px; margin: 0 auto; padding: 20px; }
								.header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
								.content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
								.info-box { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #4F46E5; }
								.footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
							</style>
						</head>
						<body>
							<div class="container">
								<div class="header">
									<h1>🔄 Ticket Reassigned</h1>
								</div>
								<div class="content">
									<p>Your ticket has been updated to ensure prompt attention.</p>
									<div class="info-box">
										<p><strong>Ticket ID:</strong> #${ticketId}</p>
										<p><strong>Category:</strong> ${ticket.category}</p>
										<p><strong>Assigned To:</strong> ${adminName}</p>
										<p>Your ticket will be handled by the new assignee.</p>
									</div>
								</div>
								<div class="footer">
									<p>This is an automated email from SST Resolve</p>
								</div>
							</div>
						</body>
						</html>
					`,
				};

				await sendEmail({
					to: studentEmail,
					subject: emailTemplate.subject,
					html: emailTemplate.html,
					ticketId: ticket.id,
					threadMessageId: originalMessageId,
					originalSubject: originalSubject,
				});
				console.log(`✅ Reassignment email sent to ${studentEmail} for ticket #${ticket.id}`);
			}
		} catch (emailError) {
			console.error("Error sending reassignment email:", emailError);
		}

		return NextResponse.json({ 
			success: true, 
			message: normalizedAssignedTo ? "Ticket reassigned successfully" : "Ticket unassigned successfully",
			assignedTo: normalizedAssignedTo,
		});
	} catch (error) {
		console.error("Error reassigning ticket:", error);
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}

