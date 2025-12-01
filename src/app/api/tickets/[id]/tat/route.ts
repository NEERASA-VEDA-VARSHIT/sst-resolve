import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tickets, categories, users } from "@/db/schema";
import type { TicketInsert } from "@/db/inferred-types";
import { eq, sql } from "drizzle-orm";
import { sendEmail, getTATSetEmail } from "@/lib/integration/email";
import { SetTATSchema } from "@/schemas/business/ticket";
import { TICKET_STATUS } from "@/conf/constants";
import { calculateTATDate } from "@/utils";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import type { TicketMetadata } from "@/db/inferred-types";
import { getStatusIdByValue } from "@/lib/status/getTicketStatuses";

/**
 * ============================================
 * /api/tickets/[id]/tat
 * ============================================
 * 
 * POST → Set TAT (Turnaround Time)
 *   - Auth: Required (Admin only)
 *   - Set expected resolution time for a ticket
 *   - Body: { tat_hours: number, tat_reason: string (optional) }
 *   - Calculates expected_resolution_date
 *   - Notifies student of commitment
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

		if (role !== "admin" && role !== "super_admin") {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const { id } = await params;
		const body = await request.json();

		// Validate input using Zod schema
		const validationResult = SetTATSchema.safeParse(body);
		if (!validationResult.success) {
			console.error("TAT validation failed:", validationResult.error.issues);
			return NextResponse.json(
				{ error: "Validation failed", details: validationResult.error.issues },
				{ status: 400 }
			);
		}

		const { tat, markInProgress } = validationResult.data;

		const ticketId = parseInt(id);
		if (isNaN(ticketId)) {
			return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
		}

		// Get current ticket with category and creator info
		const [ticket] = await db
			.select({
				id: tickets.id,
				created_by: tickets.created_by,
				category_id: tickets.category_id,
				metadata: tickets.metadata,
				group_id: tickets.group_id,
			})
			.from(tickets)
			.where(eq(tickets.id, ticketId))
			.limit(1);

		if (!ticket) {
			return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
		}

		// Get category name
		let categoryName = "Ticket";
		if (ticket.category_id) {
			const [category] = await db
				.select({ name: categories.name })
				.from(categories)
				.where(eq(categories.id, ticket.category_id))
				.limit(1);
			categoryName = category?.name || "Ticket";
		}

		// Parse existing metadata and get original email Message-ID and subject BEFORE updating
		const metadata: TicketMetadata = (ticket.metadata as TicketMetadata) || {};
		let originalMessageId: string | undefined;
		let originalSubject: string | undefined;
		if (metadata.originalEmailMessageId) {
			originalMessageId = metadata.originalEmailMessageId;
			console.log(`   🔗 Found original Message-ID for threading: ${originalMessageId}`);
		} else {
			console.warn(`   ⚠️ No originalEmailMessageId in ticket metadata for ticket #${ticketId}`);
		}
		if (metadata.originalEmailSubject) {
			originalSubject = metadata.originalEmailSubject;
			console.log(`   📝 Found original subject: ${originalSubject}`);
		}

		// Parse TAT text and calculate date
		const tatText = tat.trim();
		const tatDate = calculateTATDate(tatText);

		// Set TAT (support both setting and extending)
		// PRD v3.0: Track TAT extensions for auto-escalation (after 3 extensions)
		const isExtension = metadata.tat ? true : false;

		// Store previous values before updating (for extension tracking)
		const previousTAT = metadata.tat;
		const previousTATDate = metadata.tatDate;

		// Update TAT values in metadata
		metadata.tat = tatText;
		metadata.tatDate = tatDate.toISOString();
		metadata.tatSetAt = new Date().toISOString();
		metadata.tatSetBy = "Admin"; // You can get admin name from userId if needed

		// Track TAT extension count
		if (isExtension) {
			metadata.tatExtensions = metadata.tatExtensions || [];
			metadata.tatExtensions.push({
				previousTAT: previousTAT || "",
				newTAT: tatText,
				previousTATDate: previousTATDate || "",
				newTATDate: tatDate.toISOString(),
				extendedAt: new Date().toISOString(),
				extendedBy: userId,
			});
		} else {
			// First TAT set, initialize extension tracking
			metadata.tatExtensions = [];
		}

		// Update ticket with TAT and optionally mark as in_progress
		// Also assign ticket to the admin taking action
		const dbUser = await getOrCreateUser(userId);
		const updateData: Partial<TicketInsert> = {
			metadata: metadata as unknown,
			updated_at: new Date(),
			assigned_to: dbUser.id,
		};

		if (markInProgress) {
			// Get the status_id for "in_progress" status
			const statusId = await getStatusIdByValue(TICKET_STATUS.IN_PROGRESS);
			if (statusId) {
				updateData.status_id = statusId;
			} else {
				console.error(`[TAT API] Failed to find status_id for "${TICKET_STATUS.IN_PROGRESS}"`);
				// Continue without status update if status_id lookup fails
			}
		}

		await db
			.update(tickets)
			.set(updateData)
			.where(eq(tickets.id, ticketId));

		// If ticket is in a group, apply the same TAT to all tickets in that group
		if (ticket.group_id) {
			const groupTickets = await db
				.select({
					id: tickets.id,
					metadata: tickets.metadata,
				})
				.from(tickets)
				.where(eq(tickets.group_id, ticket.group_id));

			// Update all tickets in the group with the same TAT
			for (const groupTicket of groupTickets) {
				// Skip the ticket we just updated
				if (groupTicket.id === ticketId) continue;

				let groupTicketMetadata: TicketMetadata = {};
				
				if (groupTicket.metadata) {
					try {
						groupTicketMetadata = typeof groupTicket.metadata === 'string'
							? JSON.parse(groupTicket.metadata) as TicketMetadata
							: groupTicket.metadata as TicketMetadata;
					} catch (e) {
						// If parse fails, start with empty metadata
						groupTicketMetadata = {};
					}
				}

				// Track TAT extension if this ticket already had a TAT (check BEFORE updating)
				const wasExtension = !!groupTicketMetadata.tat;
				const previousTAT = groupTicketMetadata.tat || "";
				const previousTATDate = groupTicketMetadata.tatDate || "";

				// Apply the same TAT to this group ticket
				groupTicketMetadata.tat = tatText;
				groupTicketMetadata.tatDate = tatDate.toISOString();
				groupTicketMetadata.tatSetAt = new Date().toISOString();
				groupTicketMetadata.tatSetBy = "System (Group Sync)";

				if (wasExtension) {
					groupTicketMetadata.tatExtensions = groupTicketMetadata.tatExtensions || [];
					groupTicketMetadata.tatExtensions.push({
						previousTAT: previousTAT,
						newTAT: tatText,
						previousTATDate: previousTATDate,
						newTATDate: tatDate.toISOString(),
						extendedAt: new Date().toISOString(),
						extendedBy: userId,
					});
				} else {
					groupTicketMetadata.tatExtensions = [];
				}

				// Update the group ticket
				const groupTicketUpdateData: Partial<TicketInsert> = {
					metadata: groupTicketMetadata as unknown,
					updated_at: new Date(),
					resolution_due_at: tatDate,
				};

				await db
					.update(tickets)
					.set(groupTicketUpdateData)
					.where(eq(tickets.id, groupTicket.id));
			}
		}

		// Send email notification to student
		if (ticket.created_by) {
			try {
				// Get student email from users table using created_by
				const [creator] = await db
					.select({ email: users.email })
					.from(users)
					.where(eq(users.id, ticket.created_by))
					.limit(1);

				if (creator?.email) {
					// Use the originalMessageId we retrieved before the update
					const emailTemplate = getTATSetEmail(
						ticket.id,
						tatText,
						tatDate.toISOString(),
						categoryName,
						isExtension,
						markInProgress // Include markInProgress flag in email
					);
					const emailResult = await sendEmail({
						to: creator.email,
						subject: emailTemplate.subject,
						html: emailTemplate.html,
						ticketId: ticket.id,
						threadMessageId: originalMessageId,
						originalSubject: originalSubject,
					});

					if (!emailResult) {
						console.error(`❌ Failed to send TAT email to ${creator.email} for ticket #${ticket.id}`);
					} else {
						console.log(`✅ TAT email sent to ${creator.email} for ticket #${ticket.id}${originalMessageId ? ' (threaded)' : ''}`);
					}
				}
			} catch (emailError) {
				console.error("Error sending TAT email:", emailError);
				// Don't fail the request if email fails
			}
		}

		// Post TAT update to Slack as threaded reply (async, don't await)
		(async () => {
			try {
				if (categoryName === "Hostel" || categoryName === "College" || categoryName === "Committee") {
					const slackMessageTs = metadata.slackMessageTs;

					if (slackMessageTs) {
						const tatMessage = isExtension
							? `⏱️ *TAT Extended*\n\nTurnaround Time updated to: *${tatText}*\nTarget Date: ${new Date(tatDate).toLocaleDateString()}`
							: markInProgress
								? `⏱️ *TAT Set & Ticket In Progress*\n\nTurnaround Time: *${tatText}*\nTarget Date: ${new Date(tatDate).toLocaleDateString()}`
								: `⏱️ *TAT Updated*\n\nTurnaround Time: *${tatText}*\nTarget Date: ${new Date(tatDate).toLocaleDateString()}`;

						const { slackConfig } = await import("@/conf/config");
						const subcategory = metadata.subcategory || "";
						const key = `${categoryName}${subcategory ? ":" + subcategory : ""}`;
						const ccUserIds = (slackConfig.ccMap[key] || slackConfig.ccMap[categoryName] || slackConfig.defaultCc);
						const channelOverride: string | undefined = typeof metadata.slackChannel === "string" ? metadata.slackChannel : undefined;

						if (channelOverride) {
							const { postThreadReplyToChannel } = await import("@/lib/integration/slack");
							await postThreadReplyToChannel(channelOverride, slackMessageTs, tatMessage, ccUserIds);
						} else {
							const { postThreadReply } = await import("@/lib/integration/slack");
							await postThreadReply(
								categoryName as "Hostel" | "College" | "Committee",
								slackMessageTs,
								tatMessage,
								ccUserIds
							);
						}
						console.log(`✅ Posted TAT update to Slack thread for ticket #${ticket.id}`);
					} else {
						console.warn(`⚠️ No slackMessageTs found for ticket #${ticket.id} - Slack thread not posted`);
					}
				}
				} catch (slackError) {
				const error = slackError instanceof Error ? slackError : new Error(String(slackError));
				const errorWithCode = slackError as { code?: string; data?: unknown };
				console.error(`❌ Error posting TAT update to Slack thread for ticket #${ticket.id}:`, {
					message: error.message,
					code: errorWithCode.code,
					data: errorWithCode.data,
				});
				// Don't fail the request if Slack posting fails
			}
		})();

		return NextResponse.json({ success: true, message: markInProgress ? "TAT set and ticket marked in progress" : "TAT set" });
	} catch (error) {
		console.error("Error setting TAT:", error);
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}

