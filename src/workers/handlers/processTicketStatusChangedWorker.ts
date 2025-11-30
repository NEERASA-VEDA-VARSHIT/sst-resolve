/**
 * Worker: Process Ticket Status Changed
 * Sends notifications when a ticket status changes
 * - Posts to Slack thread
 * - Sends email to student (threaded)
 */

import { db } from "@/db";
import { tickets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { postThreadReplyToChannel } from "@/lib/integration/slack";
import { sendEmail, getStatusUpdateEmail } from "@/lib/integration/email";
import { logNotification } from "@/workers/utils";
import { STATUS_DISPLAY } from "@/conf/constants";

type StatusChangedPayload = {
  ticketId: number;
  [key: string]: unknown;
};
export async function processTicketStatusChangedWorker(payload: StatusChangedPayload) {
    console.log("[Worker] Processing ticket status changed", { payload });

    try {
        const ticket_id = typeof payload.ticket_id === 'number' ? payload.ticket_id : 
                         typeof payload.ticket_id === 'string' ? parseInt(payload.ticket_id, 10) : 0;
        const old_status = typeof payload.old_status === 'string' ? payload.old_status : '';
        const new_status = typeof payload.new_status === 'string' ? payload.new_status : '';
        const changed_by = typeof payload.changed_by === 'string' ? payload.changed_by : '';

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
        type TicketMetadata = {
          slackMessageTs?: unknown;
          [key: string]: unknown;
        };
        const metadata = (ticketData.metadata as TicketMetadata) || {};

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

        const emoji = (typeof new_status === 'string' && new_status in statusEmoji) ? statusEmoji[new_status] : "📝";
        const oldStatusDisplay = (typeof old_status === 'string' && old_status in STATUS_DISPLAY) ? STATUS_DISPLAY[old_status] : old_status;
        const newStatusDisplay = (typeof new_status === 'string' && new_status in STATUS_DISPLAY) ? STATUS_DISPLAY[new_status] : new_status;

        // 1. Post to Slack thread (if exists)
        const slackMessageTs = typeof metadata.slackMessageTs === 'string' ? metadata.slackMessageTs : undefined;
        const slackChannel = typeof metadata.slackChannel === 'string' ? metadata.slackChannel : undefined;

        if (slackMessageTs && slackChannel) {
            try {
                const slackMessage = [
                    `${emoji} *Status Changed*`,
                    `${oldStatusDisplay} → ${newStatusDisplay}`,
                    changed_by ? `By: ${changed_by}` : "",
                ]
                    .filter(Boolean)
                    .join("\n");

                const slackResult = await postThreadReplyToChannel(
                    slackChannel,
                    slackMessageTs,
                    slackMessage
                );
                console.log(`[Worker] Posted status change to Slack thread ${slackMessageTs}`);
                const replyTs = typeof slackResult?.ts === "string" ? slackResult.ts : undefined;
                await logNotification({
                    userId: null,
                    ticketId: ticket_id,
                    channel: "slack",
                    notificationType: "ticket.status_changed",
                    slackMessageId: replyTs ?? slackMessageTs,
                    sentAt: new Date(),
                });
            } catch (error) {
                console.error("[Worker] Failed to post to Slack thread:", error);
            }
        } else {
            console.log("[Worker] No Slack thread found for ticket", { ticket_id });
        }

        // 2. Send email to student (threaded)
        try {
            type Category = { name?: string; [key: string]: unknown };
            type User = { email?: string; id?: string; [key: string]: unknown };
            const category = ticketData.category as unknown as Category;
            const createdByUser = ticketData.created_by_user as unknown as User;
            const emailTemplate = getStatusUpdateEmail(
                ticket_id,
                new_status,
                typeof category?.name === 'string' ? category.name : "Unknown"
            );

            const userEmail = typeof createdByUser?.email === 'string' ? createdByUser.email : undefined;
            if (userEmail) {
                const emailResult = await sendEmail({
                    to: userEmail,
                    subject: emailTemplate.subject,
                    html: emailTemplate.html,
                    ticketId: ticket_id,
                    threadMessageId: typeof metadata.emailMessageId === 'string' ? metadata.emailMessageId : undefined,
                    originalSubject: typeof metadata.originalEmailSubject === 'string' ? metadata.originalEmailSubject : undefined,
                });

                console.log(`[Worker] Sent status change email to ${createdByUser.email}`);

                if (emailResult) {
                    await logNotification({
                        userId: typeof createdByUser.id === "string" ? createdByUser.id : null,
                        ticketId: ticket_id,
                        channel: "email",
                        notificationType: "ticket.status_changed",
                        emailMessageId: typeof emailResult.messageId === "string" ? emailResult.messageId : null,
                        sentAt: new Date(),
                    });
                }
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
