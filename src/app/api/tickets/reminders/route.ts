import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tickets, ticket_statuses } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { postThreadReply } from "@/lib/slack";
import { sendEmail, getTATReminderEmail } from "@/lib/email";

/**
 * ============================================
 * /api/tickets/reminders
 * ============================================
 * 
 * GET → Send TAT Reminders (Cron Job)
 *   - Auth: Not required (internal cron endpoint)
 *   - Should be called by automated cron job (daily)
 *   - Checks tickets where TAT date is today or has passed
 *   - Sends reminder emails to:
 *     • Assigned staff (approaching TAT deadline)
 *     • Students (TAT commitment updates)
 *   - Returns: 200 OK with count of reminders sent
 *   - Note: Consider adding secret token auth for security
 * ============================================
 */

export async function GET(request: NextRequest) {
	try {
		// This endpoint should be called by a cron job (e.g., daily)
		// Check for tickets where TAT date is today or has passed
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);

		// Get all tickets with TAT dates and their status
		const allTickets = await db
			.select({
				id: tickets.id,
				metadata: tickets.metadata,
				category_id: tickets.category_id,
				status_value: ticket_statuses.value,
				created_by: tickets.created_by,
			})
			.from(tickets)
			.leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id));

		const remindersSent = [];

		for (const ticket of allTickets) {
			if (!ticket.metadata) continue;

			type TicketMetadata = {
				[key: string]: unknown;
			};
			const metadata = ticket.metadata as TicketMetadata;

			try {
				const tatDateValue = metadata.tatDate;
				if (!tatDateValue) continue;
				const tatDate = tatDateValue instanceof Date ? tatDateValue : 
				               typeof tatDateValue === 'string' ? new Date(tatDateValue) :
				               typeof tatDateValue === 'number' ? new Date(tatDateValue) :
				               null;
				if (!tatDate || isNaN(tatDate.getTime())) continue;
				tatDate.setHours(0, 0, 0, 0);

				// Check if TAT date is today
				if (tatDate.getTime() === today.getTime()) {
					// Skip if already reminded today
					const lastReminderValue = metadata.lastReminderDate;
					if (lastReminderValue) {
						const lastReminder = lastReminderValue instanceof Date ? lastReminderValue :
						                 typeof lastReminderValue === 'string' ? new Date(lastReminderValue) :
						                 typeof lastReminderValue === 'number' ? new Date(lastReminderValue) :
						                 null;
						if (!lastReminder || isNaN(lastReminder.getTime())) continue;
						lastReminder.setHours(0, 0, 0, 0);
						if (lastReminder.getTime() === today.getTime()) {
							continue; // Already reminded today
						}
					}

					// Only send reminder for open or in_progress tickets
					if (ticket.status_value !== "RESOLVED" && ticket.status_value !== "CLOSED") {
						// Get category name (we need to fetch it or assume from metadata if stored)
						// For now, let's assume we can get it or just use "Ticket"
						// Actually, we should probably join categories table too, but let's see if we can do without for now.
						// The original code accessed ticket.category which was likely removed or changed.
						// Let's fetch category name if needed.

						// Wait, the original code had ticket.category. 
						// If tickets table doesn't have category column (it has category_id), we need to join.

						// Let's assume we need to join categories.
						const { categories } = await import("@/db/schema");
						const [categoryRow] = await db.select({ name: categories.name })
							.from(categories)
							.where(eq(categories.id, ticket.category_id || 0))
							.limit(1);

						const categoryName = categoryRow?.name || "Ticket";

						// Send reminder to Slack
						if (
							categoryName === "Hostel" ||
							categoryName === "College"
						) {
						const tatValue = typeof metadata.tat === 'string' ? metadata.tat : String(metadata.tat || '');
						const reminderText = `⏰ *TAT Reminder*\n\nTicket #${ticket.id} has reached its TAT date (${tatValue}).\n\nPlease review and update the ticket status.`;

						const slackMessageTsValue = typeof metadata.slackMessageTs === 'string' ? metadata.slackMessageTs : undefined;
						if (slackMessageTsValue) {
							await postThreadReply(
								categoryName as "Hostel" | "College",
								slackMessageTsValue,
								reminderText
							);
						}

						// Send email reminder to student
						try {
							// We need userNumber to get student email?
							// getStudentEmail takes userNumber.
							// We have created_by (UUID). We should get email directly from users table.
							const { users } = await import("@/db/schema");
							const [creator] = await db.select({ email: users.email })
								.from(users)
								.where(eq(users.id, ticket.created_by))
								.limit(1);

							const studentEmail = creator?.email;
							if (studentEmail) {
								const emailTemplate = getTATReminderEmail(
									ticket.id,
									tatValue,
									categoryName
								);

								// Get original email Message-ID and subject for threading
								const originalMessageId = typeof metadata.originalEmailMessageId === 'string' ? metadata.originalEmailMessageId : undefined;
								const originalSubject = typeof metadata.originalEmailSubject === 'string' ? metadata.originalEmailSubject : undefined;
									if (!originalMessageId) {
										console.warn(`⚠️ No originalEmailMessageId found for ticket #${ticket.id} - reminder email will not thread properly`);
									}

									const emailResult = await sendEmail({
										to: studentEmail,
										subject: emailTemplate.subject,
										html: emailTemplate.html,
										ticketId: ticket.id,
										threadMessageId: originalMessageId,
										originalSubject: originalSubject,
									});

									if (!emailResult) {
										console.error(`❌ Failed to send TAT reminder email to ${studentEmail} for ticket #${ticket.id}`);
									} else {
										console.log(`✅ TAT reminder email sent to ${studentEmail} for ticket #${ticket.id}${originalMessageId ? ' (threaded)' : ''}`);
									}
								}
							} catch (emailError) {
								console.error(`Error sending TAT reminder email for ticket ${ticket.id}:`, emailError);
								// Continue even if email fails
							}

							// Mark as reminded
							metadata.lastReminderDate = new Date().toISOString();
							await db
								.update(tickets)
								.set({ metadata: metadata })
								.where(eq(tickets.id, ticket.id));

							remindersSent.push({
								ticketId: ticket.id,
								category: categoryName,
							});
						}
					}
				}
			} catch (e) {
				console.error(`Error processing ticket ${ticket.id}:`, e);
			}
		}

		return NextResponse.json({
			success: true,
			remindersSent: remindersSent.length,
			tickets: remindersSent,
		});
	} catch (error) {
		console.error("Error sending TAT reminders:", error);
		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 }
		);
	}
}
