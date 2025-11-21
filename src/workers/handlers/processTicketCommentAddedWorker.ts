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

type CommentAddedPayload = {
  ticketId: number;
  [key: string]: unknown;
};
export async function processTicketCommentAddedWorker(payload: CommentAddedPayload) {
  console.log("[Worker] Processing ticket comment added", { payload });

  try {
    const ticket_id = typeof payload.ticket_id === 'number' ? payload.ticket_id : 
                     typeof payload.ticket_id === 'string' ? parseInt(payload.ticket_id, 10) : 0;
    const comment_text = typeof payload.comment_text === 'string' ? payload.comment_text : '';
    const author_name = typeof payload.author_name === 'string' ? payload.author_name : '';
    const author_role = typeof payload.author_role === 'string' ? payload.author_role : '';

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
        const assignedAdmin = ticketData.assigned_admin as any;
        if (assignedAdmin?.user?.email) {
          recipientEmail = assignedAdmin.user.email;
          recipientName = assignedAdmin.full_name || "Admin";
        }
      } else {
        // Notify student
        const createdByUser = ticketData.created_by_user as any;
        if (createdByUser?.email) {
          recipientEmail = createdByUser.email;
          const firstName = createdByUser.first_name || "";
          const lastName = createdByUser.last_name || "";
          recipientName = [firstName, lastName].filter(Boolean).join(" ") || "Student";
        }
      }

      if (recipientEmail) {
        type Category = { name?: string; [key: string]: unknown };
        const category = ticketData.category as unknown as Category;
        const emailTemplate = getCommentAddedEmail(
          ticket_id,
          comment_text,
          author_name,
          typeof category?.name === 'string' ? category.name : "Unknown"
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
