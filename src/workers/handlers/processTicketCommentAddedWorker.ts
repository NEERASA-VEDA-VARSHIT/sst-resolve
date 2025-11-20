/**
 * Worker: Process Ticket Comment Added
 * Sends notifications when a comment is added to a ticket
 * - Posts to Slack thread
 * - Sends email to student (threaded)
 */

import { db } from "@/db";
import { tickets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { postThreadReplyToChannel } from "@/lib/slack";
import { sendEmail, getCommentAddedEmail } from "@/lib/email";

export async function processTicketCommentAddedWorker(payload: any) {
  console.log("[Worker] Processing ticket comment added", { payload });

  try {
    const { ticket_id, comment_text, author_name, author_role } = payload;

    // Fetch ticket with all necessary data
    const ticket = await db.query.tickets.findMany({
      where: eq(tickets.id, ticket_id),
      with: {
        created_by_user: true,
        category: true,
        assigned_admin: {
          with: {
            user: true,
          },
        },
      },
      limit: 1,
    });

    if (!ticket || ticket.length === 0) {
      console.error(`[Worker] Ticket ${ticket_id} not found`);
      return;
    }

    const ticketData = ticket[0];
    const metadata = ticketData.metadata as any || {};

    // 1. Post to Slack thread (if exists)
    const slackMessageTs = metadata.slackMessageTs;
    const slackChannel = metadata.slackChannel;

    if (slackMessageTs && slackChannel) {
      try {
        const authorLabel = author_role === "student" ? "Student" : "Admin";
        await postThreadReplyToChannel(
          slackChannel,
          slackMessageTs,
          `💬 *New Comment by ${author_name}* (${authorLabel})\n${comment_text}`
        );
        console.log(`[Worker] Posted comment to Slack thread ${slackMessageTs}`);
      } catch (error) {
        console.error("[Worker] Failed to post to Slack thread:", error);
      }
    } else {
      console.log("[Worker] No Slack thread found for ticket", { ticket_id });
    }

    // 2. Send email notification
    try {
      // Determine recipient based on author
      // If student commented -> Notify Admin
      // If admin commented -> Notify Student
      let recipientEmail = "";
      let recipientName = "";

      if (author_role === "student") {
        // Notify assigned admin
        if (ticketData.assigned_admin?.user?.email) {
          recipientEmail = ticketData.assigned_admin.user.email;
          recipientName = ticketData.assigned_admin.full_name;
        }
      } else {
        // Notify student
        if (ticketData.created_by_user?.email) {
          recipientEmail = ticketData.created_by_user.email;
          recipientName = ticketData.created_by_user.name || "Student";
        }
      }

      if (recipientEmail) {
        const emailTemplate = getCommentAddedEmail(
          ticket_id,
          comment_text,
          author_name,
          ticketData.category?.name || "Unknown"
        );

        await sendEmail({
          to: recipientEmail,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          ticketId: ticket_id,
          threadMessageId: metadata.emailMessageId,
          originalSubject: metadata.originalEmailSubject,
        });

        console.log(`[Worker] Sent comment email to ${recipientName} (${recipientEmail})`);
      } else {
        console.log("[Worker] No recipient email found for comment notification");
      }
    } catch (error) {
      console.error("[Worker] Failed to send comment email:", error);
    }

    console.log("[Worker] Successfully processed comment notification");
  } catch (error) {
    console.error("[Worker] Error in processTicketCommentAddedWorker:", error);
    throw error;
  }
}
