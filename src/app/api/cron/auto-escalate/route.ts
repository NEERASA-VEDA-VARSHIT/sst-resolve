import { NextRequest, NextResponse } from "next/server";
import { db, tickets, ticket_feedback, users, roles, categories, domains } from "@/db";
import { and, eq, ne } from "drizzle-orm";
import { postThreadReply } from "@/lib/integration/slack";
import type { TicketMetadata } from "@/db/inferred-types";
import { appConfig } from "@/conf/config";
import { TICKET_STATUS } from "@/conf/constants";
import { verifyCronAuth } from "@/lib/cron-auth";
import { getStatusIdByValue } from "@/lib/status/getTicketStatuses";

// Auto-escalate tickets that haven't been updated in n days
// This should be called by a cron job (e.g., Vercel Cron, GitHub Actions, etc.)

export async function GET(request: NextRequest) {
	try {
		// Verify cron authentication (mandatory in production)
		const authError = verifyCronAuth(request);
		if (authError) {
			return authError;
		}

		const daysInactive = parseInt(request.nextUrl.searchParams.get("days") || appConfig.autoEscalationDays.toString(), 10);
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

		// Find tickets that:
		// 1. Are not closed/resolved
		// 2. Haven't been updated in n days (or created if no updates)
		// 3. Haven't been escalated recently (avoid repeated escalations)
		// OR have TAT violations (TAT date has passed)
		const resolvedStatusId = await getStatusIdByValue(TICKET_STATUS.RESOLVED);
		const inProgressStatusId = await getStatusIdByValue(TICKET_STATUS.IN_PROGRESS);
		const whereConditions = resolvedStatusId ? [ne(tickets.status_id, resolvedStatusId)] : [];
		
		// Fetch tickets with category and domain info for escalation
		const allPendingTickets = await db
			.select({
				ticket: tickets,
				category_name: categories.name,
				domain_id: categories.domain_id,
			})
			.from(tickets)
			.leftJoin(categories, eq(categories.id, tickets.category_id))
			.where(whereConditions.length > 0 ? and(...whereConditions) : undefined);
		
		// Fetch ticket feedback for rating checks
		const allFeedback = await db.select().from(ticket_feedback);
		const feedbackMap = new Map(allFeedback.map(f => [f.ticket_id, f]));

		// PRD v3.0: Filter for tickets that need auto-escalation based on escalation_rules.md:
		// 1. TAT Extension Limit - 3rd time (Rule 1)
		// 2. Ticket Overdue (SLA Breach) - resolution_due_at passed (Rule 2)
		// 3. Repeated Reopening - 3rd time (Rule 3)
		// 4. Negative Feedback (Low Rating) - 1 or 2 stars (Rule 4)
		// 5. "Ping-Pong" Forwarding - > 3 times (Rule 5)
		// 6. Stalled "In Progress" - no activity for 48 hours (Rule 6)
		const now = new Date();
		const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
		
		const ticketsToEscalate = allPendingTickets.map(({ ticket, category_name, domain_id }) => {
			let escalationReason = "";
			let hasTATViolation = false;
			let hasTATExtensionLimit = false;
			let hasRepeatedReopening = false;
			let hasNegativeFeedback = false;
			let hasPingPongForwarding = false;
			let hasStalledInProgress = false;
			let slaBreachedAt: Date | null = null;
			
			// Parse metadata
			let details: TicketMetadata = {};
			if (ticket.metadata) {
				try {
					details = typeof ticket.metadata === 'string' 
						? JSON.parse(ticket.metadata) 
						: ticket.metadata;
				} catch {
					// Ignore parse errors
				}
			}

			// Rule 1: TAT Extension Limit - 3rd time
			const tatExtensionCount = details.tatExtensions?.length || 0;
			if (tatExtensionCount >= 3) {
				hasTATExtensionLimit = true;
				escalationReason = `TAT extension limit (${tatExtensionCount} extensions)`;
			}

			// Rule 2: Ticket Overdue (SLA Breach) - resolution_due_at passed
			const dueAt = ticket.resolution_due_at || ticket.acknowledgement_due_at;
			if (dueAt) {
				const dueAtDate = new Date(dueAt);
				if (dueAtDate.getTime() < now.getTime()) {
					hasTATViolation = true;
					slaBreachedAt = dueAtDate;
					if (!escalationReason) {
						escalationReason = "SLA breach (resolution due date passed)";
					}
				}
			}
			
			// Check TAT date violation (legacy field in metadata)
			const tatDate = details.tatDate ? new Date(details.tatDate) : null;
			if (tatDate && tatDate.getTime() < now.getTime()) {
				hasTATViolation = true;
				if (!slaBreachedAt || tatDate.getTime() < slaBreachedAt.getTime()) {
					slaBreachedAt = tatDate;
				}
				if (!escalationReason) {
					escalationReason = "TAT violation (TAT date passed)";
				}
			}

			// Rule 3: Repeated Reopening - 3rd time
			const reopenCount = (details.reopen_count as number) || 0;
			if (reopenCount >= 3) {
				hasRepeatedReopening = true;
				if (!escalationReason) {
					escalationReason = `repeated reopening (${reopenCount} times)`;
				}
			}

			// Rule 4: Negative Feedback (Low Rating) - 1 or 2 stars
			const feedback = feedbackMap.get(ticket.id);
			if (feedback && feedback.rating !== null && feedback.rating <= 2) {
				hasNegativeFeedback = true;
				if (!escalationReason) {
					escalationReason = `negative feedback (${feedback.rating} star rating)`;
				}
			}

			// Rule 5: "Ping-Pong" Forwarding - > 3 times
			const forwardCount = details.forwardCount || 0;
			if (forwardCount > 3) {
				hasPingPongForwarding = true;
				if (!escalationReason) {
					escalationReason = `ping-pong forwarding (${forwardCount} forwards)`;
				}
			}

			// Rule 6: Stalled "In Progress" - no activity for 48 hours
			if (inProgressStatusId && ticket.status_id === inProgressStatusId) {
				const lastUpdate = ticket.updated_at || ticket.created_at;
				if (lastUpdate && new Date(lastUpdate).getTime() < fortyEightHoursAgo.getTime()) {
					// Check if there are any comments in the last 48 hours
					const comments = Array.isArray(details.comments) ? details.comments : [];
					const recentComments = comments.filter((c: { createdAt?: string }) => {
						if (!c.createdAt) return false;
						const commentDate = new Date(c.createdAt);
						return commentDate.getTime() > fortyEightHoursAgo.getTime();
					});
					
					if (recentComments.length === 0) {
						hasStalledInProgress = true;
						if (!escalationReason) {
							escalationReason = "stalled in progress (no activity for 48 hours)";
						}
					}
				}
			}

			const shouldEscalate = hasTATViolation || hasTATExtensionLimit || hasRepeatedReopening || 
				hasNegativeFeedback || hasPingPongForwarding || hasStalledInProgress;
			
			return { ticket, ticketMetadata: details, shouldEscalate, escalationReason, slaBreachedAt, category_name, domain_id };
		}).filter(item => item.shouldEscalate);

		const escalated = [];
		const errors = [];

		for (const { ticket, ticketMetadata, escalationReason, slaBreachedAt, category_name, domain_id } of ticketsToEscalate) {
			try {
				// Check if already escalated recently (within cooldown period)
				const lastEscalation = ticketMetadata.last_escalation_at;
				if (lastEscalation) {
					const lastEscalationDate = typeof lastEscalation === 'string' ? new Date(lastEscalation) : new Date();
					const daysSinceEscalation = (new Date().getTime() - lastEscalationDate.getTime()) / (1000 * 60 * 60 * 24);
					if (daysSinceEscalation < appConfig.escalationCooldownDays) {
						continue; // Skip if escalated recently
					}
				}

				// Increment escalation count
				const currentEscalationCount = ticket.escalation_level || 0;
				const newEscalationCount = currentEscalationCount + 1;

				// Get next escalation target based on category/location-specific rules
				// Get domain name from domain_id (categories.domain_id -> domains.name)
				let categoryNameForEscalation = "College"; // Default fallback
				if (domain_id) {
					const [domain] = await db
						.select({ name: domains.name })
						.from(domains)
						.where(eq(domains.id, domain_id))
						.limit(1);
					if (domain) {
						categoryNameForEscalation = domain.name;
					}
				} else if (category_name) {
					// Fallback: use category name if domain lookup fails
					categoryNameForEscalation = category_name;
				}
				
				const { getNextEscalationTarget } = await import("@/lib/escalation/escalation");
				const nextTarget = await getNextEscalationTarget(
					categoryNameForEscalation,
					ticket.location || null,
					currentEscalationCount
				);

				// Determine who to escalate to
				let escalatedTo: string;
				let assignedTo: string | null = null;

				if (nextTarget) {
					// Assign to next escalation target (use userId, not clerkUserId, since assigned_to is a UUID reference to users.id)
					assignedTo = nextTarget.userId;
					escalatedTo = `level_${nextTarget.level}`;
				} else {
					// No more escalation targets, escalate to super admin
					escalatedTo = newEscalationCount >= 2 ? "super_admin_urgent" : "super_admin";
					
					// Find a super admin to assign the ticket to
					const [superAdmin] = await db
						.select({ id: users.id })
						.from(users)
						.innerJoin(roles, eq(users.role_id, roles.id))
						.where(eq(roles.name, "super_admin"))
						.limit(1);
					
					if (superAdmin) {
						assignedTo = superAdmin.id;
					} else {
						const { logCriticalError } = await import("@/lib/monitoring/alerts");
						logCriticalError(
							"No super admin found during auto-escalation",
							new Error("System has no super admin - escalated tickets cannot be assigned"),
							{ ticketId: ticket.id, escalationLevel: newEscalationCount }
						);
						// Ticket will remain unassigned - this should be monitored and alerted
					}
				}

				// Update ticket metadata with escalation info
				if (!ticketMetadata.last_escalation_at || slaBreachedAt) {
					ticketMetadata.last_escalation_at = new Date().toISOString();
				}
				if (slaBreachedAt && !ticketMetadata.sla_breached_at) {
					ticketMetadata.sla_breached_at = slaBreachedAt.toISOString();
				}

				// Update ticket
				// PRD v3.0: Set status to "escalated" when auto-escalating
				const escalatedStatusId = await getStatusIdByValue(TICKET_STATUS.ESCALATED);
				const updateData: Partial<typeof tickets.$inferInsert> = {
					escalation_level: newEscalationCount,
					metadata: ticketMetadata as unknown,
					updated_at: new Date(),
				};
				
				// Set status_id if escalated status exists
				if (escalatedStatusId) {
					updateData.status_id = escalatedStatusId;
				} else {
					console.error(`[Auto-escalate] Failed to find status_id for "${TICKET_STATUS.ESCALATED}"`);
				}

				// If we have a next escalation target, assign the ticket to them
				if (assignedTo) {
					updateData.assigned_to = assignedTo;
				}

				// Handle TAT: Use escalation rule TAT only if ticket doesn't already have a TAT set
				// Admin-set TAT takes precedence (some issues might take more time)
				let metadata: TicketMetadata = {};
				if (ticket.metadata) {
					try {
						metadata = typeof ticket.metadata === 'string' 
							? JSON.parse(ticket.metadata) as TicketMetadata
							: ticket.metadata as TicketMetadata;
					} catch {
						// Ignore parse errors
					}
				}

				const hasExistingTAT = metadata.tatDate || ticket.resolution_due_at;
				
				// Only set TAT from escalation rule if ticket doesn't have one
				if (!hasExistingTAT && nextTarget && nextTarget.tat_hours) {
					const now = new Date();
					const newTATDate = new Date(now.getTime() + nextTarget.tat_hours * 60 * 60 * 1000);
					
					// Set TAT in metadata
					metadata.tat = `${nextTarget.tat_hours} hours`;
					metadata.tatDate = newTATDate.toISOString();
					metadata.tatSetAt = new Date().toISOString();
					metadata.tatSetBy = "System (Auto-escalation)";
					
					// Set resolution_due_at
					updateData.resolution_due_at = newTATDate;
					updateData.metadata = metadata as unknown;
				} else if (hasExistingTAT) {
					// Preserve existing TAT - admin knows the issue might take more time
					// Ticket already has TAT set, preserving it
				}

				await db
					.update(tickets)
					.set(updateData)
					.where(eq(tickets.id, ticket.id));

				// Send Slack notification (reuse metadata already parsed above)
				const details = ticketMetadata;
				const categoryNameForSlack = category_name || categoryNameForEscalation || "College"; // Default fallback

				// Check if category_id exists (assuming non-null means it's a valid category)
				if (ticket.category_id) {
					const slackMessageTs = details.slackMessageTs;
					if (slackMessageTs) {
						try {
							// Use the escalation reason determined earlier
							const reason = escalationReason || `automatic escalation trigger`;

							const escalationText = `🚨 *AUTO-ESCALATION #${newEscalationCount}*\nTicket #${ticket.id} has been automatically escalated due to: ${reason}.\nEscalation count: ${newEscalationCount}\nEscalated to: ${escalatedTo === "super_admin_urgent" ? "Super Admin (URGENT)" : "Super Admin"}`;
							
							const { slackConfig } = await import("@/conf/config");
							const ccUserIds = slackConfig.defaultCc;

							const channelOverride = details.slackChannel;
							if (channelOverride) {
								const { postThreadReplyToChannel } = await import("@/lib/integration/slack");
								await postThreadReplyToChannel(
									channelOverride,
									slackMessageTs,
									escalationText,
									ccUserIds
								);
							} else {
								// Use the category name we determined earlier
								await postThreadReply(
									categoryNameForSlack as "College" | "Hostel" | "Committee",
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

