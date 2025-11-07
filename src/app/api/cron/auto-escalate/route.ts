import { NextRequest, NextResponse } from "next/server";
import { db, tickets } from "@/db";
import { and, lt, or, eq, isNull, ne } from "drizzle-orm";
import { postThreadReply } from "@/lib/slack";
import { sendEmail, getEscalationEmail, getStudentEmail } from "@/lib/email";
import { appConfig, cronConfig } from "@/conf/config";

// Auto-escalate tickets that haven't been updated in n days
// This should be called by a cron job (e.g., Vercel Cron, GitHub Actions, etc.)

export async function GET(request: NextRequest) {
	try {
		// Verify cron secret (if using Vercel Cron or similar)
		const authHeader = request.headers.get("authorization");
		if (cronConfig.secret && authHeader !== `Bearer ${cronConfig.secret}`) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const daysInactive = parseInt(request.nextUrl.searchParams.get("days") || appConfig.autoEscalationDays.toString(), 10);
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

		// Find tickets that:
		// 1. Are not closed/resolved
		// 2. Haven't been updated in n days (or created if no updates)
		// 3. Haven't been escalated recently (avoid repeated escalations)
		// OR have TAT violations (TAT date has passed)
		const allPendingTickets = await db
			.select()
			.from(tickets)
			.where(
				and(
					or(
						ne(tickets.status, "closed"),
						isNull(tickets.status)
					),
					ne(tickets.status, "resolved")
				)
			);

		// Filter for inactive tickets OR TAT violations
		const now = new Date();
		const inactiveTickets = allPendingTickets.filter(ticket => {
			// Check inactivity
			const lastUpdate = ticket.updatedAt || ticket.createdAt;
			const isInactive = lastUpdate && new Date(lastUpdate).getTime() < cutoffDate.getTime();

			// Check TAT violation
			let hasTATViolation = false;
			if (ticket.details) {
				try {
					const details = JSON.parse(ticket.details);
					const tatDate = details.tatDate ? new Date(details.tatDate) : null;
					if (tatDate && tatDate.getTime() < now.getTime()) {
						hasTATViolation = true;
					}
				} catch (e) {
					// Ignore parse errors
				}
			}

			return isInactive || hasTATViolation;
		});

		const escalated = [];
		const errors = [];

		for (const ticket of inactiveTickets) {
			try {
				// Check if already escalated recently (within cooldown period)
				const lastEscalation = ticket.escalatedAt;
				if (lastEscalation) {
					const daysSinceEscalation = (new Date().getTime() - new Date(lastEscalation).getTime()) / (1000 * 60 * 60 * 24);
					if (daysSinceEscalation < appConfig.escalationCooldownDays) {
						continue; // Skip if escalated recently
					}
				}

				// Increment escalation count
				const currentEscalationCount = parseInt(ticket.escalationCount || "0", 10);
				const newEscalationCount = currentEscalationCount + 1;

				// Get next escalation target based on category/location-specific rules
				const { getNextEscalationTarget } = await import("@/lib/escalation");
				const nextTarget = await getNextEscalationTarget(
					ticket.category || "College",
					ticket.location || null,
					currentEscalationCount
				);

				// Determine who to escalate to
				let escalatedTo: string;
				let assignedTo: string | null = null;

				if (nextTarget) {
					// Assign to next escalation target
					assignedTo = nextTarget.clerkUserId;
					escalatedTo = `level_${nextTarget.level}`;
				} else {
					// No more escalation targets, escalate to super admin
					escalatedTo = newEscalationCount >= 2 ? "super_admin_urgent" : "super_admin";
				}

				// Update ticket
				const updateData: any = {
					escalationCount: newEscalationCount.toString(),
					escalatedAt: new Date(),
					escalatedTo: escalatedTo,
					updatedAt: new Date(),
				};

				// If we have a next escalation target, assign the ticket to them
				if (assignedTo) {
					updateData.assignedTo = assignedTo;
				}

				await db
					.update(tickets)
					.set(updateData)
					.where(eq(tickets.id, ticket.id));

				// Send Slack notification
				let details: any = {};
				if (ticket.details) {
					try {
						details = JSON.parse(ticket.details);
					} catch (e) {
						// Ignore parse errors
					}
				}

				if (ticket.category === "Hostel" || ticket.category === "College") {
					const slackMessageTs = details.slackMessageTs;
					if (slackMessageTs) {
						try {
							// Determine escalation reason
							let reason = `inactivity (${daysInactive} days)`;
							if (details.tatDate) {
								const tatDate = new Date(details.tatDate);
								if (tatDate.getTime() < now.getTime()) {
									const hoursOverdue = (now.getTime() - tatDate.getTime()) / (1000 * 60 * 60);
									reason = `TAT violation (overdue by ${Math.floor(hoursOverdue)} hours)`;
								}
							}

							const escalationText = `🚨 *AUTO-ESCALATION #${newEscalationCount}*\nTicket #${ticket.id} has been automatically escalated due to ${reason}.\nEscalation count: ${newEscalationCount}\nEscalated to: ${escalatedTo === "super_admin_urgent" ? "Super Admin (URGENT)" : "Super Admin"}`;
							
							const { slackConfig } = await import("@/conf/config");
							const ccUserIds =
								slackConfig.ccMap[
									`${ticket.category}${ticket.subcategory ? ":" + ticket.subcategory : ""}`
								] ||
								slackConfig.ccMap[ticket.category] ||
								slackConfig.defaultCc;

							const channelOverride = details.slackChannel;
							if (channelOverride) {
								const { postThreadReplyToChannel } = await import("@/lib/slack");
								await postThreadReplyToChannel(
									channelOverride,
									slackMessageTs,
									escalationText,
									ccUserIds
								);
							} else {
								await postThreadReply(
									ticket.category as "Hostel" | "College",
									slackMessageTs,
									escalationText,
									ccUserIds
								);
							}
						} catch (slackError) {
							console.error(`❌ Error posting auto-escalation to Slack for ticket #${ticket.id}:`, slackError);
						}
					}
				}

				// Send email notification
				try {
					const studentEmail = await getStudentEmail(ticket.userNumber);
					if (studentEmail) {
						const emailTemplate = getEscalationEmail(
							ticket.id,
							ticket.category,
							newEscalationCount
						);
						const originalMessageId = details.originalEmailMessageId;
						const originalSubject = details.originalEmailSubject;
						await sendEmail({
							to: studentEmail,
							subject: emailTemplate.subject,
							html: emailTemplate.html,
							ticketId: ticket.id,
							threadMessageId: originalMessageId,
							originalSubject: originalSubject,
						});
					}
				} catch (emailError) {
					console.error(`❌ Error sending auto-escalation email for ticket #${ticket.id}:`, emailError);
				}

				escalated.push(ticket.id);
			} catch (error) {
				console.error(`❌ Error auto-escalating ticket #${ticket.id}:`, error);
				errors.push(ticket.id);
			}
		}

		return NextResponse.json({
			success: true,
			message: `Auto-escalation completed`,
			escalated: escalated.length,
			ticketIds: escalated,
			errors: errors.length,
		});
	} catch (error) {
		console.error("Error in auto-escalation:", error);
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}

