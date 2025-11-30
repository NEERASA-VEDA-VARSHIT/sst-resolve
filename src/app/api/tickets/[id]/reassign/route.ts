import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, tickets, users, categories, outbox } from "@/db";
import type { TicketInsert } from "@/db/inferred-types";
import { eq } from "drizzle-orm";
import { ReassignTicketSchema } from "@/schemas/business/ticket";
import { postThreadReply } from "@/lib/integration/slack";
import { sendEmail } from "@/lib/integration/email";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";

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
		
		// Validate input using schema
		const parsed = ReassignTicketSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Validation failed", details: parsed.error.format() },
				{ status: 400 }
			);
		}
		
		const { assigned_to } = parsed.data;
		
		// Convert "unassigned" to null, otherwise it should be a database user UUID
		const normalizedAssignedTo = assigned_to === "unassigned" ? null : assigned_to;
 
		// Get current ticket with category info
		const [ticket] = await db
			.select({
				id: tickets.id,
				category_id: tickets.category_id,
				category_name: categories.name,
				location: tickets.location,
				assigned_to: tickets.assigned_to,
				created_by: tickets.created_by,
				metadata: tickets.metadata,
			})
			.from(tickets)
			.leftJoin(categories, eq(tickets.category_id, categories.id))
			.where(eq(tickets.id, ticketId))
			.limit(1);

		if (!ticket) {
			return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
		}

		// Parse existing metadata
		type TicketMetadata = {
			[key: string]: unknown;
		};
		let metadata: TicketMetadata = {};
		let originalMessageId: string | undefined;
		let originalSubject: string | undefined;
		if (ticket.metadata) {
			try {
				metadata = typeof ticket.metadata === 'object' ? ticket.metadata : JSON.parse(String(ticket.metadata));
				originalMessageId = typeof metadata.originalEmailMessageId === 'string' ? metadata.originalEmailMessageId : undefined;
				originalSubject = typeof metadata.originalEmailSubject === 'string' ? metadata.originalEmailSubject : undefined;
			} catch (e) {
				console.error("Error parsing metadata:", e);
			}
		}

		// Validate new assignee and get admin name
		// The assignedTo might be a Clerk ID or a database UUID
		let adminName = "Admin";
		let databaseUserId: string | null = null;
		
		if (normalizedAssignedTo && normalizedAssignedTo !== "unassigned") {
			// Check if it's a Clerk ID (starts with "user_") or a UUID
			const isClerkId = normalizedAssignedTo.startsWith("user_");
			
			if (isClerkId) {
				// Convert Clerk ID to database user UUID
				const dbUser = await getOrCreateUser(normalizedAssignedTo);
				if (!dbUser) {
					return NextResponse.json({ error: "Selected user not found in database" }, { status: 400 });
				}
				databaseUserId = dbUser.id;
     adminName = dbUser.full_name?.trim() || dbUser.email || "Admin";
			} else {
				// It's already a database UUID, verify the user exists
				const [targetUser] = await db
					.select({
						id: users.id,
						full_name: users.full_name,
						email: users.email,
					})
					.from(users)
					.where(eq(users.id, normalizedAssignedTo))
					.limit(1);

				if (!targetUser) {
					return NextResponse.json({ error: "Selected user not found" }, { status: 400 });
				}

				databaseUserId = targetUser.id;
				adminName = targetUser.full_name?.trim() || targetUser.email || "Admin";
			}
		} else {
			adminName = "Unassigned";
		}

		// Get previous assignee name for notifications
		let previousAssigneeName = "Unassigned";
		if (ticket.assigned_to) {
			const [prevUser] = await db
				.select({
					full_name: users.full_name,
					email: users.email,
				})
				.from(users)
				.where(eq(users.id, ticket.assigned_to!))
				.limit(1);
			if (prevUser) {
				previousAssigneeName = prevUser.full_name?.trim() || prevUser.email || "Unknown";
			}
		}

		// Update ticket with database user ID and create outbox event for notifications
		await db.transaction(async (tx) => {
			const updateData: Partial<TicketInsert> = {
				assigned_to: databaseUserId,
				updated_at: new Date(),
			};
			
			await tx
				.update(tickets)
				.set(updateData)
				.where(eq(tickets.id, ticketId));

			// Create outbox event for reassignment notifications (decoupled)
			await tx.insert(outbox).values({
				event_type: "ticket.reassigned",
				payload: {
					ticket_id: ticketId,
					previous_assigned_to: ticket.assigned_to,
					new_assigned_to: databaseUserId,
					previous_assignee_name: previousAssigneeName,
					new_assignee_name: adminName,
					category_name: ticket.category_name,
					reassigned_by: userId,
				},
				attempts: 0,
			});
		});

		// Send notifications immediately (for real-time updates)
		// Also handled by worker for reliability
		try {
			// Send Slack notification (if category supports it and thread exists)
			const slackMessageTs = typeof metadata.slackMessageTs === 'string' ? metadata.slackMessageTs : undefined;
			if (slackMessageTs && (ticket.category_name === "Hostel" || ticket.category_name === "College")) {
				try {
					const reassignText = normalizedAssignedTo
						? `🔄 *Ticket Reassigned*\nTicket #${ticketId} has been reassigned to ${adminName}.\nPrevious assignment: ${previousAssigneeName}`
						: `🔄 *Ticket Unassigned*\nTicket #${ticketId} is now unassigned.\nPrevious assignment: ${previousAssigneeName}`;
					await postThreadReply(
						ticket.category_name as "Hostel" | "College",
						slackMessageTs,
						reassignText
					);
					console.log(`✅ Posted reassignment to Slack thread for ticket #${ticketId}`);
				} catch (slackError) {
					console.error(`❌ Error posting reassignment to Slack for ticket #${ticketId}:`, slackError);
				}
			}

			// Send email notification to student
			const [studentUser] = await db
				.select({
					email: users.email,
					full_name: users.full_name,
				})
				.from(users)
				.where(eq(users.id, ticket.created_by!))
				.limit(1);

			const studentEmail = studentUser?.email;
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
										<p><strong>Category:</strong> ${ticket.category_name || "Unknown"}</p>
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
										<p><strong>Category:</strong> ${ticket.category_name || "Unknown"}</p>
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
		} catch (notificationError) {
			console.error("Error sending reassignment notifications:", notificationError);
			// Don't fail the request if notifications fail - outbox event will handle retry
		}

		return NextResponse.json({ 
			success: true, 
			message: databaseUserId ? "Ticket reassigned successfully" : "Ticket unassigned successfully",
			assignedTo: databaseUserId,
		});
	} catch (error) {
		console.error("Error reassigning ticket:", error);
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}

