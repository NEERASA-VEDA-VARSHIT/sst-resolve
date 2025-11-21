import { NextRequest, NextResponse } from "next/server";
import { db, tickets, ticket_statuses } from "@/db";
import { and, lt, or, eq, isNull, ne } from "drizzle-orm";
import { postThreadReply } from "@/lib/slack";
import { sendEmail, getEscalationEmail, getStudentEmail } from "@/lib/email";
import { appConfig, cronConfig } from "@/conf/config";
import { TICKET_STATUS, DEFAULTS } from "@/conf/constants";
import { getStatusIdByValue } from "@/lib/status-helpers";

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
		// Get status IDs for filtering
		const closedStatusId = await getStatusIdByValue("CLOSED");
		const resolvedStatusId = await getStatusIdByValue("RESOLVED");
		
		// Build where clause to exclude closed/resolved tickets
		const statusFilter = and(
			closedStatusId ? ne(tickets.status_id, closedStatusId) : undefined,
			resolvedStatusId ? ne(tickets.status_id, resolvedStatusId) : undefined
		);

		const allPendingTickets = await db
			.select()
			.from(tickets)
			.where(statusFilter);

		// PRD v3.0: Filter for tickets that need auto-escalation:
		// 1. Inactive tickets (not updated in n days)
		// 2. TAT violations (TAT date has passed)
		// 3. Tickets with 3+ TAT extensions
		// 4. Tickets exceeding lifecycle (total time since creation)
		const now = new Date();
		const ticketsToEscalate = allPendingTickets.map(ticket => {
			// Check inactivity
			const lastUpdate = ticket.updated_at || ticket.created_at;
			const isInactive = lastUpdate && new Date(lastUpdate).getTime() < cutoffDate.getTime();

			// Check TAT violation
			let hasTATViolation = false;
			let hasTATExtensionLimit = false;
			let hasLifecycleBreach = false;
			let slaBreachedAt: Date | null = null;
			
			// Check if resolution_due_at (SLA) has been breached
			const dueAt = ticket.resolution_due_at || ticket.acknowledgement_due_at;
			if (dueAt) {
				const dueAtDate = new Date(dueAt);
				if (dueAtDate.getTime() < now.getTime()) {
					hasTATViolation = true;
					slaBreachedAt = dueAtDate; // Use due_at as SLA breach time
				}
			}
			
			if (ticket.metadata) {
				try {
					const details = typeof ticket.metadata === 'string' 
						? JSON.parse(ticket.metadata) 
						: ticket.metadata;
					
					// Check TAT date violation (legacy field in details)
					const tatDate = details.tatDate ? new Date(details.tatDate) : null;
					if (tatDate && tatDate.getTime() < now.getTime()) {
						hasTATViolation = true;
						// Use earlier of due_at or tatDate as SLA breach time
						if (!slaBreachedAt || tatDate.getTime() < slaBreachedAt.getTime()) {
							slaBreachedAt = tatDate;
						}
					}
					
					// PRD v3.0: Check for 3+ TAT extensions
					const tatExtensionCount = details.tatExtensionCount || 0;
					if (tatExtensionCount >= DEFAULTS.MAX_TAT_EXTENSIONS) {
						hasTATExtensionLimit = true;
					}
					
					// PRD v3.0: Check lifecycle breach (tickets exceeding total lifecycle)
					// Lifecycle breach: ticket created more than AUTO_ESCALATION_DAYS ago
					const createdAt = ticket.created_at ? new Date(ticket.created_at) : null;
					if (createdAt && createdAt.getTime() < cutoffDate.getTime()) {
						hasLifecycleBreach = true;
					}
				} catch (e) {
					// Ignore parse errors
				}
			}

			const shouldEscalate = isInactive || hasTATViolation || hasTATExtensionLimit || hasLifecycleBreach;
			return { ticket, shouldEscalate, slaBreachedAt };
		}).filter(item => item.shouldEscalate);

		const escalated = [];
		const errors = [];

		for (const { ticket, slaBreachedAt } of ticketsToEscalate) {
			try {
				// Check if already escalated recently (within cooldown period)
				const lastEscalation = ticket.last_escalation_at;
				if (lastEscalation) {
					const daysSinceEscalation = (new Date().getTime() - new Date(lastEscalation).getTime()) / (1000 * 60 * 60 * 24);
					if (daysSinceEscalation < appConfig.escalationCooldownDays) {
						continue; // Skip if escalated recently
					}
				}

				// Increment escalation count
				const currentEscalationCount = ticket.escalation_level || 0;
				const newEscalationCount = currentEscalationCount + 1;

				// Get next escalation target based on category/location-specific rules
				// Note: ticket.category and ticket.location are not direct fields - need to join with categories table
				// For now, using a fallback approach - this should be improved to use proper category lookup
				const { getNextEscalationTarget } = await import("@/lib/escalation");
				const categoryName = "College"; // TODO: Get actual category name from category_id join
				const nextTarget = await getNextEscalationTarget(
					categoryName,
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
				// PRD v3.0: Set status to "escalated" when auto-escalating
				const escalatedStatusId = await getStatusIdByValue(TICKET_STATUS.ESCALATED);
				if (!escalatedStatusId) {
					console.error(`❌ Status "${TICKET_STATUS.ESCALATED}" not found in database`);
					errors.push(ticket.id);
					continue;
				}

				const updateData: any = {
					escalation_level: newEscalationCount,
					last_escalation_at: new Date(),
					status_id: escalatedStatusId,
					updated_at: new Date(),
				};
				
				// Set sla_breached_at if SLA was breached (for reporting and analytics)
				// Only set if not already set (preserve first breach time)
				if (slaBreachedAt) {
					updateData.sla_breached_at = slaBreachedAt;
				}

				// If we have a next escalation target, assign the ticket to them
				if (assignedTo) {
					updateData.assigned_to = assignedTo;
				}

				await db
					.update(tickets)
					.set(updateData)
					.where(eq(tickets.id, ticket.id));

				// Send Slack notification
				let details: any = {};
				if (ticket.metadata) {
					try {
						details = typeof ticket.metadata === 'string' 
							? JSON.parse(ticket.metadata) 
							: ticket.metadata;
					} catch (e) {
						// Ignore parse errors
					}
				}

				// TODO: Get actual category name from category_id join
				// For now, check if category_id exists (assuming non-null means it's a valid category)
				if (ticket.category_id) {
					const slackMessageTs = details.slackMessageTs;
					if (slackMessageTs) {
						try {
							// Determine escalation reason (PRD v3.0)
							let reason = `inactivity (${daysInactive} days)`;
							const tatExtensionCount = details.tatExtensionCount || 0;
							
							if (tatExtensionCount >= DEFAULTS.MAX_TAT_EXTENSIONS) {
								reason = `exceeded TAT extension limit (${tatExtensionCount} extensions)`;
							} else if (details.tatDate) {
								const tatDate = new Date(details.tatDate);
								if (tatDate.getTime() < now.getTime()) {
									const hoursOverdue = (now.getTime() - tatDate.getTime()) / (1000 * 60 * 60);
									reason = `TAT violation (overdue by ${Math.floor(hoursOverdue)} hours)`;
								}
							}
							
							// Check lifecycle breach
							const createdAt = ticket.created_at ? new Date(ticket.created_at) : null;
							if (createdAt && createdAt.getTime() < cutoffDate.getTime()) {
								if (reason === `inactivity (${daysInactive} days)`) {
									reason = `lifecycle breach (ticket open for ${daysInactive}+ days)`;
								}
							}

							const escalationText = `🚨 *AUTO-ESCALATION #${newEscalationCount}*\nTicket #${ticket.id} has been automatically escalated due to ${reason}.\nEscalation count: ${newEscalationCount}\nEscalated to: ${escalatedTo === "super_admin_urgent" ? "Super Admin (URGENT)" : "Super Admin"}`;
							
							const { slackConfig } = await import("@/conf/config");
							// TODO: Get actual category/subcategory names from joins
							// For now, use default mapping
							const ccUserIds = slackConfig.defaultCc;

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
								// TODO: Get actual category name from category_id join
								// Default to College for now
								await postThreadReply(
									"College",
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
				// TODO: Re-enable email sending once we can properly join user data to get user_number
				// For now, email sending is disabled as we need to join with users table to get user_number
				// try {
				// 	const studentEmail = await getStudentEmail(ticket.userNumber);
				// 	if (studentEmail) {
				// 		const emailTemplate = getEscalationEmail(
				// 			ticket.id,
				// 			categoryName,
				// 			newEscalationCount
				// 		);
				// 		const originalMessageId = details.originalEmailMessageId;
				// 		const originalSubject = details.originalEmailSubject;
				// 		await sendEmail({
				// 			to: studentEmail,
				// 			subject: emailTemplate.subject,
				// 			html: emailTemplate.html,
				// 			ticketId: ticket.id,
				// 			threadMessageId: originalMessageId,
				// 			originalSubject: originalSubject,
				// 		});
				// 	}
				// } catch (emailError) {
				// 	console.error(`❌ Error sending auto-escalation email for ticket #${ticket.id}:`, emailError);
				// }

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

