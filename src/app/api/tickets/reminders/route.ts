import { NextRequest, NextResponse } from "next/server";
import { db, tickets } from "@/db";
import { and, eq, ne } from "drizzle-orm";
import { postThreadReply } from "@/lib/slack";
import { sendEmail, getTATReminderEmail, getStudentEmail } from "@/lib/email";

export async function GET(request: NextRequest) {
	try {
		// This endpoint should be called by a cron job (e.g., daily)
		// Check for tickets where TAT date is today or has passed
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);

		// Get all tickets with TAT dates
		const allTickets = await db.select().from(tickets);

		const remindersSent = [];

		for (const ticket of allTickets) {
			if (!ticket.details) continue;

			try {
				const details = JSON.parse(ticket.details);
				if (!details.tatDate) continue;

				const tatDate = new Date(details.tatDate);
				tatDate.setHours(0, 0, 0, 0);

				// Check if TAT date is today
				if (tatDate.getTime() === today.getTime()) {
					// Skip if already reminded today
					if (details.lastReminderDate) {
						const lastReminder = new Date(details.lastReminderDate);
						lastReminder.setHours(0, 0, 0, 0);
						if (lastReminder.getTime() === today.getTime()) {
							continue; // Already reminded today
						}
					}

					// Only send reminder for open or in_progress tickets
					if (ticket.status !== "closed" && ticket.status !== null) {
						// Send reminder to Slack
						if (
							ticket.category === "Hostel" ||
							ticket.category === "College"
						) {
							const reminderText = `⏰ *TAT Reminder*\n\nTicket #${ticket.id} has reached its TAT date (${details.tat}).\n\nPlease review and update the ticket status.`;

							if (details.slackMessageTs) {
								await postThreadReply(
									ticket.category as "Hostel" | "College",
									details.slackMessageTs,
									reminderText
								);
							}

							// Send email reminder to student
							try {
								const studentEmail = await getStudentEmail(ticket.userNumber);
								if (studentEmail) {
									const emailTemplate = getTATReminderEmail(
										ticket.id,
										details.tat,
										ticket.category
									);
									
									// Get original email Message-ID and subject for threading
									const originalMessageId = details.originalEmailMessageId;
									const originalSubject = details.originalEmailSubject;
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
							details.lastReminderDate = new Date().toISOString();
							await db
								.update(tickets)
								.set({ details: JSON.stringify(details) })
								.where(eq(tickets.id, ticket.id));

							remindersSent.push({
								ticketId: ticket.id,
								category: ticket.category,
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

