/**
 * Worker: Process Ticket Status Changed
 * Sends notifications when a ticket status changes
 * - Posts to Slack thread
 * - Sends email to student (threaded)
 */

import { db } from "@/db";
import { tickets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { postThreadReplyToChannel } from "@/lib/slack";
import { sendEmail, getStatusUpdateEmail } from "@/lib/email";
import { STATUS_DISPLAY } from "@/conf/constants";

export async function processTicketStatusChangedWorker(payload: any) {
    console.log("[Worker] Processing ticket status changed", { payload });

    try {
        const { ticket_id, old_status, new_status, changed_by } = payload;

        // Fetch ticket with all necessary data
        const ticket = await db.query.tickets.findMany({
            where: eq(tickets.id, ticket_id),
            with: {
                created_by_user: true,
                category: true,
            },
            limit: 1,
        });

        if (!ticket || ticket.length === 0) {
            console.error(`[Worker] Ticket ${ticket_id} not found`);
            return;
        }

        const ticketData = ticket[0];
        const metadata = ticketData.metadata as any || {};

        // Status emoji mapping
        const statusEmoji: Record<string, string> = {
            OPEN: "🆕",
            IN_PROGRESS: "🔄",
            AWAITING_STUDENT: "⏸️",
            RESOLVED: "✅",
            ESCALATED: "🚨",
            FORWARDED: "➡️",
            REOPENED: "🔓",
        };

        const emoji = statusEmoji[new_status] || "📝";
        const oldStatusDisplay = STATUS_DISPLAY[old_status] || old_status;
        const newStatusDisplay = STATUS_DISPLAY[new_status] || new_status;

        // 1. Post to Slack thread (if exists)
        const slackMessageTs = metadata.slackMessageTs;
        const slackChannel = metadata.slackChannel;

        if (slackMessageTs && slackChannel) {
            try {
                const slackMessage = [
                    `${emoji} *Status Changed*`,
                    `${oldStatusDisplay} → ${newStatusDisplay}`,
                    changed_by ? `By: ${changed_by}` : "",
                ]
                    .filter(Boolean)
                    .join("\n");

                await postThreadReplyToChannel(
                    slackChannel,
                    slackMessageTs,
                    slackMessage
                );
                console.log(`[Worker] Posted status change to Slack thread ${slackMessageTs}`);
            } catch (error) {
                console.error("[Worker] Failed to post to Slack thread:", error);
            }
        } else {
            console.log("[Worker] No Slack thread found for ticket", { ticket_id });
        }

        // 2. Send email to student (threaded)
        try {
            const category = ticketData.category as any;
            const createdByUser = ticketData.created_by_user as any;
            const emailTemplate = getStatusUpdateEmail(
                ticket_id,
                new_status,
                category?.name || "Unknown"
            );

            if (createdByUser?.email) {
                await sendEmail({
                    to: createdByUser.email,
                    subject: emailTemplate.subject,
                    html: emailTemplate.html,
                    ticketId: ticket_id,
                    threadMessageId: metadata.emailMessageId,
                    originalSubject: metadata.originalEmailSubject,
                });

                console.log(`[Worker] Sent status change email to ${createdByUser.email}`);
            }
        } catch (error) {
            console.error("[Worker] Failed to send status change email:", error);
        }

        console.log("[Worker] Successfully processed status change notification");
    } catch (error) {
        console.error("[Worker] Error in processTicketStatusChangedWorker:", error);
        throw error;
    }
}
