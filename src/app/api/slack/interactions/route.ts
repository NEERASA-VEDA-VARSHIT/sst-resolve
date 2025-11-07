import { NextRequest, NextResponse } from "next/server";
import { db, tickets } from "@/db";
import { eq } from "drizzle-orm";
import { WebClient } from "@slack/web-api";
import { postThreadReply } from "@/lib/slack";
import { sendEmail, getStatusUpdateEmail, getTATSetEmail, getCommentAddedEmail, getStudentEmail } from "@/lib/email";

import { calculateTATDate } from "@/utils";

const slack = process.env.SLACK_BOT_TOKEN
	? new WebClient(process.env.SLACK_BOT_TOKEN)
	: null;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
	// Slack URL verification (if needed)
	return NextResponse.json({ message: "Slack interactions endpoint is active" });
}

export async function POST(request: NextRequest) {
	try {
		// Slack sends interactions as form-encoded data
		const formData = await request.formData();
		const payload = formData.get("payload") as string | null;
		
		if (!payload || typeof payload !== "string" || payload.length === 0) {
			return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
		}

		const interaction = JSON.parse(payload);
		
		// Handle button clicks
		if (interaction.type === "block_actions") {
			const action = interaction.actions[0];
			const actionId = action.action_id;
			const value = action.value as string;
			
			// Extract ticket ID from value (format: "action_ticketId")
			const ticketId = parseInt(value.split("_").pop() || "0");
			
			if (!ticketId) {
				return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
			}

			// Defer DB fetch until needed to reduce latency and avoid Slack timeouts
			const user = interaction.user.name || interaction.user.id;

			switch (actionId) {
				case "ticket_in_progress": {
					// Open TAT modal instead of directly marking in progress
					const modal = {
						type: "modal",
						callback_id: "set_tat_modal",
						title: {
							type: "plain_text",
							text: "Update TAT",
						},
						submit: {
							type: "plain_text",
							text: "Set TAT & Progress",
						},
						close: {
							type: "plain_text",
							text: "Cancel",
						},
						blocks: [
							{
								type: "section",
								text: {
									type: "mrkdwn",
									text: `Please set the Turnaround Time (TAT) for Ticket #${ticketId}. The ticket will be marked as "In Progress" after setting TAT.`,
								},
							},
							{
								type: "input",
								block_id: "tat_input",
								element: {
									type: "plain_text_input",
									action_id: "tat_value",
									placeholder: {
										type: "plain_text",
										text: "e.g., 2 days, 1 week, 3 hours",
									},
								},
								label: {
									type: "plain_text",
									text: "Turnaround Time (TAT)",
								},
							},
						],
						private_metadata: JSON.stringify({ ticketId, markInProgress: true }),
					};

					try {
						// Open modal asynchronously - don't await to avoid timeout
						slack?.views.open({
							trigger_id: interaction.trigger_id,
							view: modal as any,
						}).catch((err) => {
							console.error("Error opening TAT modal:", err);
						});

						// Return immediately to avoid timeout
						return new NextResponse(null, { status: 200 });
					} catch (error) {
						console.error("Error in TAT modal setup:", error);
						return NextResponse.json({ error: "Failed to open modal" }, { status: 500 });
					}
				}

				case "ticket_set_tat": {
					if (!slack) {
						return NextResponse.json({ error: "Slack not configured" }, { status: 500 });
					}

					if (!interaction.trigger_id) {
						return NextResponse.json({ error: "Missing trigger_id" }, { status: 400 });
					}

					// Open a modal for TAT input
					const modal = {
						type: "modal",
						callback_id: "set_tat_modal",
						title: {
							type: "plain_text",
							text: "Update TAT",
						},
						submit: {
							type: "plain_text",
							text: "Submit",
						},
						close: {
							type: "plain_text",
							text: "Cancel",
						},
						blocks: [
							{
								type: "section",
								text: {
									type: "mrkdwn",
									text: `Setting TAT for Ticket #${ticketId}`,
								},
							},
							{
								type: "input",
								block_id: "tat_input",
								element: {
									type: "plain_text_input",
									action_id: "tat_value",
									placeholder: {
										type: "plain_text",
										text: "e.g., 2 hours, 1 day, 3 days",
									},
								},
								label: {
									type: "plain_text",
									text: "Turnaround Time (TAT)",
								},
							},
						],
						private_metadata: JSON.stringify({ ticketId }),
					};

					try {
						// Open modal asynchronously - don't await to avoid timeout
						slack.views.open({
							trigger_id: interaction.trigger_id,
							view: modal as any,
						}).catch((err) => {
							console.error("Error opening TAT modal:", err);
						});

						// Return immediately to avoid timeout - empty response for modal opening
						return new NextResponse(null, { status: 200 });
					} catch (error) {
						console.error("Error in TAT modal setup:", error);
						return NextResponse.json({ error: "Failed to open modal" }, { status: 500 });
					}
				}

				case "ticket_add_comment": {
					if (!slack) {
						return NextResponse.json({ error: "Slack not configured" }, { status: 500 });
					}

					if (!interaction.trigger_id) {
						return NextResponse.json({ error: "Missing trigger_id" }, { status: 400 });
					}

					// Open a modal for comment input
					const modal = {
						type: "modal",
						callback_id: "add_comment_modal",
						title: {
							type: "plain_text",
							text: "Add Comment",
						},
						submit: {
							type: "plain_text",
							text: "Submit",
						},
						close: {
							type: "plain_text",
							text: "Cancel",
						},
						blocks: [
							{
								type: "section",
								text: {
									type: "mrkdwn",
									text: `Adding comment to Ticket #${ticketId}`,
								},
							},
							{
								type: "input",
								block_id: "comment_input",
								element: {
									type: "plain_text_input",
									action_id: "comment_value",
									multiline: true,
									placeholder: {
										type: "plain_text",
										text: "Enter your comment...",
									},
								},
								label: {
									type: "plain_text",
									text: "Comment",
								},
							},
						],
						private_metadata: JSON.stringify({ ticketId }),
					};

					try {
						// Open modal asynchronously - don't await to avoid timeout
						slack.views.open({
							trigger_id: interaction.trigger_id,
							view: modal as any,
						}).catch((err) => {
							console.error("Error opening comment modal:", err);
						});

						// Return immediately to avoid timeout - empty response for modal opening
						return new NextResponse(null, { status: 200 });
					} catch (error) {
						console.error("Error in comment modal setup:", error);
						return NextResponse.json({ error: "Failed to open modal" }, { status: 500 });
					}
				}

				case "ticket_close": {
					try {
						// Fetch ticket
						const [ticket] = await db
							.select()
							.from(tickets)
							.where(eq(tickets.id, ticketId))
							.limit(1);
						if (!ticket) {
							return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
						}
						const details = ticket.details ? JSON.parse(ticket.details) : {};
						// Get original email Message-ID and subject for threading BEFORE updating
						const originalMessageId = details.originalEmailMessageId;
						const originalSubject = details.originalEmailSubject;

						await db
							.update(tickets)
							.set({ status: "closed" })
							.where(eq(tickets.id, ticketId));

						// Return response immediately to avoid Slack timeout
						const response = NextResponse.json({ text: "✅ Ticket closed" });

						// Send email and update Slack asynchronously (don't await)
						(async () => {
							try {
								// Send email notification to student
								const studentEmail = await getStudentEmail(ticket.userNumber);
								if (studentEmail) {
									const emailTemplate = getStatusUpdateEmail(
										ticket.id,
										"closed",
										ticket.category
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
										console.error(`❌ Failed to send status update email to ${studentEmail} for ticket #${ticket.id}`);
									} else {
										console.log(`✅ Status update email sent to ${studentEmail} for ticket #${ticket.id} (status: closed) via Slack`);
									}
								}
							} catch (emailError) {
								console.error("Error sending status update email:", emailError);
							}

							// Update Slack message
							if (slack && interaction.channel?.id && interaction.message?.ts) {
								try {
									await slack.chat.update({
										channel: interaction.channel.id,
										ts: interaction.message.ts,
										text: interaction.message.text || "",
										blocks: [
											...(interaction.message.blocks || []).slice(0, -1),
											{
												type: "context",
												elements: [
													{
														type: "mrkdwn",
														text: `✅ *Ticket Closed* by <@${user}> at ${new Date().toLocaleString()}`,
													},
												],
											},
											...(interaction.message.blocks || []).slice(-1),
										],
									} as any);
								} catch (err: any) {
									console.error("Error updating Slack message:", {
										message: err.message,
										code: err.code,
										data: err.data,
									});
								}
							}
						})();

						return response;
					} catch (error) {
						console.error("Error closing ticket:", error);
						return NextResponse.json({ error: "Failed to close ticket" }, { status: 500 });
					}
				}

				case "ticket_reopen": {
					try {
						// Fetch ticket
						const [ticket] = await db
							.select()
							.from(tickets)
							.where(eq(tickets.id, ticketId))
							.limit(1);
						if (!ticket) {
							return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
						}
						const details = ticket.details ? JSON.parse(ticket.details) : {};
						// Get original email Message-ID and subject for threading BEFORE updating
						const originalMessageId = details.originalEmailMessageId;
						const originalSubject = details.originalEmailSubject;

						await db
							.update(tickets)
							.set({ status: "open" })
							.where(eq(tickets.id, ticketId));

						// Return response immediately to avoid Slack timeout
						const response = NextResponse.json({ text: "🔄 Ticket reopened" });

						// Send email and update Slack asynchronously (don't await)
						(async () => {
							try {
								// Send email notification to student
								const studentEmail = await getStudentEmail(ticket.userNumber);
								if (studentEmail) {
									const emailTemplate = getStatusUpdateEmail(
										ticket.id,
										"open",
										ticket.category
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
										console.error(`❌ Failed to send status update email to ${studentEmail} for ticket #${ticket.id}`);
									} else {
										console.log(`✅ Status update email sent to ${studentEmail} for ticket #${ticket.id} (status: open) via Slack`);
									}
								}
							} catch (emailError) {
								console.error("Error sending status update email:", emailError);
							}

							// Update Slack message
							if (slack && interaction.channel?.id && interaction.message?.ts) {
								try {
									await slack.chat.update({
										channel: interaction.channel.id,
										ts: interaction.message.ts,
										text: interaction.message.text || "",
										blocks: [
											...(interaction.message.blocks || []).slice(0, -1),
											{
												type: "context",
												elements: [
													{
														type: "mrkdwn",
														text: `🔄 *Ticket Reopened* by <@${user}> at ${new Date().toLocaleString()}`,
													},
												],
											},
											...(interaction.message.blocks || []).slice(-1),
										],
									} as any);
								} catch (err: any) {
									console.error("Error updating Slack message:", {
										message: err.message,
										code: err.code,
										data: err.data,
									});
								}
							}
						})();

						return response;
					} catch (error) {
						console.error("Error reopening ticket:", error);
						return NextResponse.json({ error: "Failed to reopen ticket" }, { status: 500 });
					}
				}
			}
		}

		// Handle modal submissions
		if (interaction.type === "view_submission") {
			const metadata = JSON.parse(interaction.view.private_metadata || "{}");
			const ticketId = metadata.ticketId;

			if (interaction.view.callback_id === "set_tat_modal") {
				const tatValue =
					interaction.view.state.values.tat_input?.tat_value?.value || "";
				
				const [ticket] = await db
					.select()
					.from(tickets)
					.where(eq(tickets.id, ticketId))
					.limit(1);

				const markInProgress = metadata.markInProgress || false;

				const details = ticket.details ? JSON.parse(ticket.details) : {};
				const isExtension = details.tat ? true : false;
				
				// Get original email Message-ID and subject for threading BEFORE updating
				const originalMessageId = details.originalEmailMessageId;
				const originalSubject = details.originalEmailSubject;
				
				// Parse TAT text and calculate date
				const tatDate = calculateTATDate(tatValue);
				
				details.tat = tatValue;
				details.tatDate = tatDate.toISOString();
				details.tatSetAt = new Date().toISOString();
				details.tatSetBy = interaction.user.name || interaction.user.id;
				if (isExtension) {
					details.tatExtendedAt = new Date().toISOString();
				}

				// Update ticket with TAT and optionally mark as in_progress
				// Note: For Slack actions, we can't assign to a specific Clerk userId since we only have Slack user ID
				// Assignment will happen when admins take actions from the web dashboard
				const updateData: any = { details: JSON.stringify(details) };
				if (markInProgress) {
					updateData.status = "in_progress";
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
				// This prevents Slack timeout while still performing the actions
				(async () => {
					try {
						// Send email notification to student
						const studentEmail = await getStudentEmail(ticket.userNumber);
						if (studentEmail) {
							const emailTemplate = getTATSetEmail(
								ticket.id,
								tatValue,
								tatDate.toISOString(),
								ticket.category,
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
							} else {
								console.log(`✅ TAT email sent to ${studentEmail} for ticket #${ticket.id}${originalMessageId ? ' (threaded)' : ''} via Slack`);
							}
						}
					} catch (emailError) {
						console.error("Error sending TAT email:", emailError);
					}

					// Post TAT update to Slack as threaded reply
					if (ticket.category === "Hostel" || ticket.category === "College") {
						const slackMessageTs = details.slackMessageTs;
						
						if (slackMessageTs) {
							const tatMessage = isExtension
								? `⏱️ *TAT Extended*\n\nTurnaround Time updated to: *${tatValue}*\nTarget Date: ${new Date(tatDate).toLocaleDateString()}\nExtended by <@${interaction.user.id || interaction.user.name}>`
								: markInProgress
								? `⏱️ *TAT Set & Ticket In Progress*\n\nTurnaround Time: *${tatValue}*\nTarget Date: ${new Date(tatDate).toLocaleDateString()}\nSet by <@${interaction.user.id || interaction.user.name}>`
								: `⏱️ *TAT Updated*\n\nTurnaround Time: *${tatValue}*\nTarget Date: ${new Date(tatDate).toLocaleDateString()}\nUpdated by <@${interaction.user.id || interaction.user.name}>`;

							try {
								const { slackConfig } = await import("@/conf/config");
								const key = `${ticket.category}${ticket.subcategory ? ":" + ticket.subcategory : ""}`;
								const ccUserIds = (slackConfig.ccMap[key] || slackConfig.ccMap[ticket.category] || slackConfig.defaultCc);
								const channelOverride: string | undefined = typeof details.slackChannel === "string" ? details.slackChannel : undefined;
								if (channelOverride) {
									const { postThreadReplyToChannel } = await import("@/lib/slack");
									await postThreadReplyToChannel(channelOverride, slackMessageTs, tatMessage, ccUserIds);
								} else {
									await postThreadReply(
										ticket.category as "Hostel" | "College",
										slackMessageTs,
										tatMessage,
										ccUserIds
									);
								}
							} catch (err: any) {
								console.error(`❌ Error posting TAT update to Slack for ticket #${ticketId}:`, {
									message: err.message,
									code: err.code,
									data: err.data,
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

				const [ticket] = await db
					.select()
					.from(tickets)
					.where(eq(tickets.id, ticketId))
					.limit(1);

				const details = ticket.details ? JSON.parse(ticket.details) : {};
				if (!details.comments) details.comments = [];
				
				// Get original email Message-ID and subject for threading BEFORE updating
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
					.set({ details: JSON.stringify(details) })
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
				// This prevents Slack timeout while still performing the actions
				(async () => {
					// Post comment as thread reply in Slack
					if (ticket.category === "Hostel" || ticket.category === "College") {
						const slackMessageTs = details.slackMessageTs;
						if (slackMessageTs) {
							try {
								const commentText = `💬 *Comment by ${authorName}:*\n${commentValue}`;
								const { slackConfig } = await import("@/conf/config");
								const key = `${ticket.category}${ticket.subcategory ? ":" + ticket.subcategory : ""}`;
								const ccUserIds = (slackConfig.ccMap[key] || slackConfig.ccMap[ticket.category] || slackConfig.defaultCc);
								const channelOverride: string | undefined = typeof details.slackChannel === "string" ? details.slackChannel : undefined;
								if (channelOverride) {
									const { postThreadReplyToChannel } = await import("@/lib/slack");
									await postThreadReplyToChannel(channelOverride, slackMessageTs, commentText, ccUserIds);
								} else {
									await postThreadReply(
										ticket.category as "Hostel" | "College",
										slackMessageTs,
										commentText,
										ccUserIds
									);
								}
							} catch (slackError: any) {
								console.error(`❌ Error posting comment to Slack thread for ticket #${ticketId}:`, {
									message: slackError.message,
									code: slackError.code,
									data: slackError.data,
								});
							}
						}
					}

					// Send email notification to student for admin comments
					try {
						const studentEmail = await getStudentEmail(ticket.userNumber);
						if (studentEmail) {
							const emailTemplate = getCommentAddedEmail(
								ticket.id,
								commentValue,
								authorName,
								ticket.category
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
							} else {
								console.log(`✅ Comment email sent to ${studentEmail} for ticket #${ticket.id}${originalMessageId ? ' (threaded)' : ''} via Slack`);
							}
						}
					} catch (emailError) {
						console.error("Error sending comment email:", emailError);
					}
				})();

				return response;
			}
		}

		return NextResponse.json({ text: "OK" });
	} catch (error) {
		console.error("Error handling Slack interaction:", error);
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}

