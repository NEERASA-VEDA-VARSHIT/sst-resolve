import { NextRequest, NextResponse } from "next/server";
import { db, tickets, categories, users } from "@/db";
import { eq } from "drizzle-orm";
import { postThreadReply } from "@/lib/integration/slack";
import { sendEmail, getStatusUpdateEmail, getTATSetEmail, getCommentAddedEmail, getStudentEmail } from "@/lib/integration/email";
import { calculateTATDate } from "@/utils";
import type { TicketMetadata } from "@/db/inferred-types";
import { TICKET_STATUS } from "@/conf/constants";
import { getStatusIdByValue } from "@/lib/status/getTicketStatuses";

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const interaction = body;

		// Handle different interaction types
		switch (interaction.type) {
			case "block_actions": {
				const action = interaction.actions?.[0];
				if (!action) {
					return NextResponse.json({ text: "OK" });
				}

				switch (action.action_id) {
					case "ticket_close": {
						const ticketId = parseInt(action.value || "0");
						if (isNaN(ticketId)) {
							return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
						}

						// Fetch ticket with joins
						const [ticketData] = await db
							.select({
								ticket: tickets,
								category: categories,
								creator: users,
							})
							.from(tickets)
							.leftJoin(categories, eq(tickets.category_id, categories.id))
							.leftJoin(users, eq(tickets.created_by, users.id))
							.where(eq(tickets.id, ticketId))
							.limit(1);

						if (!ticketData || !ticketData.ticket) {
							return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
						}

						const { ticket, category, creator } = ticketData;
						const details = ticket.metadata ? (ticket.metadata as TicketMetadata) : {};
						const originalMessageId = details.originalEmailMessageId;
						const originalSubject = details.originalEmailSubject;

						// Get the status_id for "resolved" status
						const resolvedStatusId = await getStatusIdByValue(TICKET_STATUS.RESOLVED);
						if (!resolvedStatusId) {
							console.error(`[Slack Interactions] Failed to find status_id for "${TICKET_STATUS.RESOLVED}"`);
							return NextResponse.json({ error: "Failed to resolve ticket" }, { status: 500 });
						}

						await db
							.update(tickets)
							.set({ status_id: resolvedStatusId, updated_at: new Date() })
							.where(eq(tickets.id, ticketId));

						// Send notifications asynchronously
						(async () => {
							try {
								const studentEmail = creator ? await getStudentEmail(creator.id) : null;
								if (studentEmail) {
									const emailTemplate = getStatusUpdateEmail(
										ticket.id,
										"RESOLVED",
										category?.name || "General"
									);
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
								console.error("Error sending close email:", emailError);
							}
						})();

						return NextResponse.json({ text: "OK" });
					}
					default:
						return NextResponse.json({ text: "OK" });
				}
			}
			case "view_submission": {
				// Handle modal submissions (TAT and comment modals)
				const metadata = JSON.parse(interaction.view.private_metadata || "{}");
				const ticketId = metadata.ticketId;

				if (interaction.view.callback_id === "set_tat_modal") {
					const tatValue =
						interaction.view.state.values.tat_input?.tat_value?.value || "";

					// Fetch ticket with joins
					const [ticketData] = await db
						.select({
							ticket: tickets,
							category: categories,
							creator: users,
						})
						.from(tickets)
						.leftJoin(categories, eq(tickets.category_id, categories.id))
						.leftJoin(users, eq(tickets.created_by, users.id))
						.where(eq(tickets.id, ticketId))
						.limit(1);

					if (!ticketData || !ticketData.ticket) {
						return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
					}

					const { ticket, category, creator } = ticketData;
					const markInProgress = metadata.markInProgress || false;
					const details: TicketMetadata = ticket.metadata ? (ticket.metadata as TicketMetadata) : {};
					const isExtension = !!details.tat;
					const originalMessageId = details.originalEmailMessageId;
					const originalSubject = details.originalEmailSubject;

					// Parse TAT text and calculate date
					const tatDate = calculateTATDate(tatValue);

					details.tat = tatValue;
					details.tatDate = tatDate.toISOString();
					details.tatSetAt = new Date().toISOString();
					details.tatSetBy = interaction.user.name || interaction.user.id;
					// Note: TAT extension tracking is handled via tatExtensions array, not tatExtendedAt

					// Update ticket with TAT and optionally mark as IN_PROGRESS
					const updateData: { metadata: TicketMetadata; status_id?: number } = { metadata: details };

					if (markInProgress) {
						// Get the status_id for "in_progress" status
						const statusId = await getStatusIdByValue(TICKET_STATUS.IN_PROGRESS);
						if (statusId) {
							updateData.status_id = statusId;
						} else {
							console.error(`[Slack Interactions] Failed to find status_id for "${TICKET_STATUS.IN_PROGRESS}"`);
						}
					}

					await db
						.update(tickets)
						.set(updateData)
						.where(eq(tickets.id, ticketId));

					// Return response to Slack immediately (within 3 second timeout)
					const response = NextResponse.json({
						response_action: "update",
						view: {
							type: "modal",
							title: {
								type: "plain_text",
								text: "TAT Set",
							},
							blocks: [
								{
									type: "section",
									text: {
										type: "mrkdwn",
										text: markInProgress
											? `✅ TAT set to: *${tatValue}* and Ticket #${ticketId} marked as *In Progress*`
											: `✅ TAT set to: *${tatValue}* for Ticket #${ticketId}`,
									},
								},
							],
						},
					});

					// Send email and Slack updates asynchronously (don't await)
					(async () => {
						try {
							const studentEmail = creator ? await getStudentEmail(creator.id) : null;
							if (studentEmail) {
								const emailTemplate = getTATSetEmail(
									ticket.id,
									tatValue,
									tatDate.toISOString(),
									category?.name || "General",
									isExtension,
									markInProgress
								);
								const emailResult = await sendEmail({
									to: studentEmail,
									subject: emailTemplate.subject,
									html: emailTemplate.html,
									ticketId: ticket.id,
									threadMessageId: originalMessageId,
									originalSubject: originalSubject,
								});

								if (!emailResult) {
									console.error(`❌ Failed to send TAT email to ${studentEmail} for ticket #${ticket.id}`);
								}
							}
						} catch (emailError) {
							console.error("Error sending TAT email:", emailError);
						}

						// Post TAT update to Slack as threaded reply
						const categoryName = category?.name || "General";
						if (categoryName === "Hostel" || categoryName === "College") {
							const slackMessageTs = details.slackMessageTs;
							if (slackMessageTs) {
								const tatMessage = isExtension
									? `⏱️ *TAT Extended*\n\nTurnaround Time updated to: *${tatValue}*\nTarget Date: ${new Date(tatDate).toLocaleDateString()}\nExtended by <@${interaction.user.id || interaction.user.name}>`
									: markInProgress
										? `⏱️ *TAT Set & Ticket In Progress*\n\nTurnaround Time: *${tatValue}*\nTarget Date: ${new Date(tatDate).toLocaleDateString()}\nSet by <@${interaction.user.id || interaction.user.name}>`
										: `⏱️ *TAT Updated*\n\nTurnaround Time: *${tatValue}*\nTarget Date: ${new Date(tatDate).toLocaleDateString()}\nUpdated by <@${interaction.user.id || interaction.user.name}>`;

								try {
									const { slackConfig } = await import("@/conf/config");
									const key = categoryName;
									const ccUserIds = (slackConfig.ccMap[key] || slackConfig.ccMap[categoryName] || slackConfig.defaultCc);
									const channelOverride: string | undefined = typeof details.slackChannel === "string" ? details.slackChannel : undefined;
									if (channelOverride) {
										const { postThreadReplyToChannel } = await import("@/lib/integration/slack");
										await postThreadReplyToChannel(channelOverride, slackMessageTs, tatMessage, ccUserIds);
									} else {
										await postThreadReply(
											categoryName as "Hostel" | "College",
											slackMessageTs,
											tatMessage,
											ccUserIds
										);
									}
								} catch (err) {
									const errorMessage = err instanceof Error ? err.message : String(err);
									const errorCode = err && typeof err === 'object' && 'code' in err ? String(err.code) : undefined;
									const errorData = err && typeof err === 'object' && 'data' in err ? err.data : undefined;
									console.error(`❌ Error posting TAT update to Slack for ticket #${ticketId}:`, {
										message: errorMessage,
										code: errorCode,
										data: errorData,
									});
								}
							}
						}
					})();

					return response;
				}

				if (interaction.view.callback_id === "add_comment_modal") {
					const commentValue =
						interaction.view.state.values.comment_input?.comment_value?.value || "";

					// Fetch ticket with joins
					const [ticketData] = await db
						.select({
							ticket: tickets,
							category: categories,
							creator: users,
						})
						.from(tickets)
						.leftJoin(categories, eq(tickets.category_id, categories.id))
						.leftJoin(users, eq(tickets.created_by, users.id))
						.where(eq(tickets.id, ticketId))
						.limit(1);

					if (!ticketData || !ticketData.ticket) {
						return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
					}

					const { ticket, category, creator } = ticketData;
					const details: TicketMetadata = ticket.metadata ? (ticket.metadata as TicketMetadata) : {};
					if (!details.comments) details.comments = [];
					const originalMessageId = details.originalEmailMessageId;
					const originalSubject = details.originalEmailSubject;
					const authorName = interaction.user.name || interaction.user.id;

					details.comments.push({
						text: commentValue,
						author: authorName,
						createdAt: new Date().toISOString(),
						source: "slack",
					});

					await db
						.update(tickets)
						.set({ metadata: details })
						.where(eq(tickets.id, ticketId));

					// Return response to Slack immediately (within 3 second timeout)
					const response = NextResponse.json({
						response_action: "update",
						view: {
							type: "modal",
							title: {
								type: "plain_text",
								text: "Comment Added",
							},
							blocks: [
								{
									type: "section",
									text: {
										type: "mrkdwn",
										text: `✅ Comment added to Ticket #${ticketId}`,
									},
								},
							],
						},
					});

					// Post comment and send email asynchronously (don't await)
					(async () => {
						// Post comment as thread reply in Slack
						const categoryName = category?.name || "General";
						if (categoryName === "Hostel" || categoryName === "College") {
							const slackMessageTs = details.slackMessageTs;
							if (slackMessageTs) {
								try {
									const commentText = `💬 *Comment by ${authorName}:*\n${commentValue}`;
									const { slackConfig } = await import("@/conf/config");
									const key = categoryName;
									const ccUserIds = (slackConfig.ccMap[key] || slackConfig.ccMap[categoryName] || slackConfig.defaultCc);
									const channelOverride: string | undefined = typeof details.slackChannel === "string" ? details.slackChannel : undefined;
									if (channelOverride) {
										const { postThreadReplyToChannel } = await import("@/lib/integration/slack");
										await postThreadReplyToChannel(channelOverride, slackMessageTs, commentText, ccUserIds);
									} else {
										await postThreadReply(
											categoryName as "Hostel" | "College",
											slackMessageTs,
											commentText,
											ccUserIds
										);
									}
								} catch (slackError) {
									const errorDetails = slackError instanceof Error 
										? { message: slackError.message }
										: { message: String(slackError) };
									console.error(`❌ Error posting comment to Slack thread for ticket #${ticketId}:`, {
										...errorDetails,
									});
								}
							}
						}

						// Send email notification to student for admin comments
						try {
							const studentEmail = creator ? await getStudentEmail(creator.id) : null;
							if (studentEmail) {
								const emailTemplate = getCommentAddedEmail(
									ticket.id,
									commentValue,
									authorName,
									categoryName
								);
								const emailResult = await sendEmail({
									to: studentEmail,
									subject: emailTemplate.subject,
									html: emailTemplate.html,
									ticketId: ticket.id,
									threadMessageId: originalMessageId,
									originalSubject: originalSubject,
								});

								if (!emailResult) {
									console.error(`❌ Failed to send comment email to ${studentEmail} for ticket #${ticket.id}`);
								}
							}
						} catch (emailError) {
							console.error("Error sending comment email:", emailError);
						}
					})();

					return response;
				}

				return NextResponse.json({ text: "OK" });
			}
			default:
				return NextResponse.json({ text: "OK" });
		}
	} catch (error) {
		console.error("Error handling Slack interaction:", error);
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
