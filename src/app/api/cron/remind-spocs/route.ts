import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tickets, users, categories, admin_profiles, ticket_statuses } from "@/db/schema";
import { eq, and, isNotNull, aliasedTable, inArray } from "drizzle-orm";
import { postThreadReplyToChannel } from "@/lib/integration/slack";
import { sendEmail } from "@/lib/integration/email";
import { verifyCronAuth } from "@/lib/cron-auth";
import { getStatusIdByValue } from "@/lib/status/getTicketStatuses";

/**
 * GET /api/cron/remind-spocs
 * Cron job to send reminders to SPOCs for pending tickets
 * Should be called periodically (e.g., every 6 hours)
 * 
 * Security: Protected with CRON_SECRET (mandatory in production)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron authentication (mandatory in production)
    const authError = verifyCronAuth(request);
    if (authError) {
      return authError;
    }

    const now = new Date();
    const reminders = [];
    const errors = [];

    // Alias for SPOC user and profile
    const spocUser = aliasedTable(users, "spoc_user");
    const spocProfile = aliasedTable(admin_profiles, "spoc_profile");

    // Find all open/in_progress tickets that:
    // 1. Are assigned to a SPOC
    // 2. Have not been acknowledged OR have TAT that is due/overdue
    // Get status IDs for filtering
    const [openStatusId, inProgressStatusId, awaitingStudentStatusId, reopenedStatusId] = await Promise.all([
      getStatusIdByValue("open"),
      getStatusIdByValue("in_progress"),
      getStatusIdByValue("awaiting_student"),
      getStatusIdByValue("reopened"),
    ]);

    const statusIds = [openStatusId, inProgressStatusId, awaitingStudentStatusId, reopenedStatusId].filter((id): id is number => id !== null);

    const pendingTickets = await db
      .select({
        id: tickets.id,
        status: ticket_statuses.value,
        assigned_to: tickets.assigned_to,
        created_at: tickets.created_at,
        metadata: tickets.metadata,
        category_name: categories.name,
        subcategory_id: tickets.subcategory_id,
        creator_phone: users.phone,
        spoc_email: spocUser.email,
        spoc_slack_id: spocProfile.slack_user_id,
      })
      .from(tickets)
      .leftJoin(ticket_statuses, eq(ticket_statuses.id, tickets.status_id))
      .leftJoin(categories, eq(tickets.category_id, categories.id))
      .leftJoin(users, eq(tickets.created_by, users.id))
      .leftJoin(spocUser, eq(tickets.assigned_to, spocUser.id))
      .leftJoin(spocProfile, eq(spocProfile.user_id, spocUser.id))
      .where(
        and(
          statusIds.length > 0 ? inArray(tickets.status_id, statusIds) : undefined,
          isNotNull(tickets.assigned_to)
        )
      );

    for (const ticket of pendingTickets) {
      try {
        // Check if ticket needs reminder
        let needsReminder = false;
        let reminderReason = "";

        // Case 1: Not acknowledged and created more than 2 hours ago
        // Check if ticket has acknowledgement_due_at set (indicates it was acknowledged)
        const hasAcknowledged = ticket.metadata && typeof ticket.metadata === 'object' && 
          (ticket.metadata as Record<string, unknown>).acknowledgedAt;
        
        if (!hasAcknowledged && ticket.created_at) {
          const hoursSinceCreation =
            (now.getTime() - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60);
          if (hoursSinceCreation >= 2) {
            needsReminder = true;
            reminderReason = `Ticket not acknowledged (created ${Math.floor(hoursSinceCreation)} hours ago)`;
          }
        }

        // Case 2: Acknowledged but TAT is due/overdue
        if (hasAcknowledged && ticket.metadata) {
          try {
            const details = ticket.metadata as Record<string, unknown>;
            const tatDate = details.tatDate && typeof details.tatDate === 'string' ? new Date(details.tatDate) : null;
            if (tatDate && tatDate.getTime() <= now.getTime()) {
              needsReminder = true;
              const hoursOverdue =
                (now.getTime() - tatDate.getTime()) / (1000 * 60 * 60);
              reminderReason = `TAT overdue by ${Math.floor(hoursOverdue)} hours`;
            }
          } catch {
            // Ignore parse errors
          }
        }

        if (!needsReminder) continue;

        // Get SPOC info
        if (!ticket.assigned_to) continue;

        // Send Slack reminder
        if (ticket.category_name === "Hostel" || ticket.category_name === "College") {
          try {
            const details = (ticket.metadata as Record<string, unknown>) || {};
            const slackMessageTs = typeof details.slackMessageTs === 'string' ? details.slackMessageTs : undefined;
            if (slackMessageTs) {
              const { slackConfig } = await import("@/conf/config");
              // Note: subcategory name is not fetched, so we might miss subcategory specific CCs.
              // But for now, let's use category name.
              const ccUserIds =
                slackConfig.ccMap[ticket.category_name] ||
                slackConfig.defaultCc;

              const reminderText = `⏰ *Reminder*\n${reminderReason}\nTicket #${ticket.id} requires attention.\n${ticket.spoc_slack_id ? `<@${ticket.spoc_slack_id}>` : ""
                }`;

              const channelOverride = typeof details.slackChannel === 'string' ? details.slackChannel : null;
              if (channelOverride) {
                await postThreadReplyToChannel(
                  channelOverride,
                  slackMessageTs,
                  reminderText,
                  ccUserIds
                );
              } else {
                const { postThreadReply } = await import("@/lib/integration/slack");
                await postThreadReply(
                  ticket.category_name as "Hostel" | "College",
                  slackMessageTs,
                  reminderText,
                  ccUserIds
                );
              }
              reminders.push({
                ticketId: ticket.id,
                reason: reminderReason,
                channel: "slack",
              });
            }
          } catch (slackError) {
            console.error(
              `❌ Error sending Slack reminder for ticket #${ticket.id}:`,
              slackError
            );
            errors.push({
              ticketId: ticket.id,
              error: "Slack reminder failed",
            });
          }
        }

        // Send email reminder to SPOC (if email available)
        if (ticket.spoc_email) {
          try {
            const emailSubject = `Reminder: Ticket #${ticket.id} Requires Attention`;
            const emailBody = `Reminder: ${reminderReason}\n\nTicket #${ticket.id}\nCategory: ${ticket.category_name}\nUser Phone: ${ticket.creator_phone || "N/A"}\n\nPlease take action on this ticket.`;
            await sendEmail({
              to: ticket.spoc_email,
              subject: emailSubject,
              html: emailBody.replace(/\n/g, '<br>'),
            });
            reminders.push({
              ticketId: ticket.id,
              reason: reminderReason,
              channel: "email",
            });
          } catch (emailError) {
            console.error(
              `❌ Error sending email reminder for ticket #${ticket.id}:`,
              emailError
            );
          }
        }
      } catch (error) {
        console.error(`Error processing reminder for ticket #${ticket.id}:`, error);
        errors.push({
          ticketId: ticket.id,
          error: String(error),
        });
      }
    }

    return NextResponse.json({
      success: true,
      remindersSent: reminders.length,
      reminders,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error in remind-spocs cron:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
