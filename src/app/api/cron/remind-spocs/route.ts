import { NextRequest, NextResponse } from "next/server";
import { db, tickets, users, ticket_statuses, categories } from "@/db/schema";
import { eq, and, or, isNotNull, aliasedTable } from "drizzle-orm";
import { postThreadReplyToChannel } from "@/lib/slack";
import { sendEmail } from "@/lib/email";

/**
 * GET /api/cron/remind-spocs
 * Cron job to send reminders to SPOCs for pending tickets
 * Should be called periodically (e.g., every 6 hours)
 */
export async function GET(request: NextRequest) {
  try {
    // Optional: Add authentication/authorization check for cron endpoint
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const reminders = [];
    const errors = [];

    // Alias for SPOC user
    const spocUser = aliasedTable(users, "spoc_user");

    // Find all open/in_progress tickets that:
    // 1. Are assigned to a SPOC
    // 2. Have not been acknowledged OR have TAT that is due/overdue
    const pendingTickets = await db
      .select({
        id: tickets.id,
        status_value: ticket_statuses.value,
        assigned_to: tickets.assigned_to,
        created_at: tickets.created_at,
        acknowledged_at: tickets.acknowledged_at,
        metadata: tickets.metadata,
        category_name: categories.name,
        subcategory_id: tickets.subcategory_id,
        user_number: users.phone,
        spoc_email: spocUser.email,
        spoc_slack_id: spocUser.slack_user_id,
      })
      .from(tickets)
      .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
      .leftJoin(categories, eq(tickets.category_id, categories.id))
      .leftJoin(users, eq(tickets.created_by, users.id)) // Creator
      .leftJoin(spocUser, eq(tickets.assigned_to, spocUser.id)) // SPOC
      .where(
        and(
          or(
            eq(ticket_statuses.value, "OPEN"),
            eq(ticket_statuses.value, "IN_PROGRESS"),
            eq(ticket_statuses.value, "AWAITING_STUDENT"),
            eq(ticket_statuses.value, "REOPENED")
          ),
          isNotNull(tickets.assigned_to)
        )
      );

    for (const ticket of pendingTickets) {
      try {
        // Check if ticket needs reminder
        let needsReminder = false;
        let reminderReason = "";

        // Case 1: Not acknowledged and created more than 2 hours ago
        if (!ticket.acknowledged_at && ticket.created_at) {
          const hoursSinceCreation =
            (now.getTime() - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60);
          if (hoursSinceCreation >= 2) {
            needsReminder = true;
            reminderReason = `Ticket not acknowledged (created ${Math.floor(hoursSinceCreation)} hours ago)`;
          }
        }

        // Case 2: Acknowledged but TAT is due/overdue
        if (ticket.acknowledged_at && ticket.metadata) {
          try {
            const details = ticket.metadata as any;
            const tatDate = details.tatDate ? new Date(details.tatDate) : null;
            if (tatDate && tatDate.getTime() <= now.getTime()) {
              needsReminder = true;
              const hoursOverdue =
                (now.getTime() - tatDate.getTime()) / (1000 * 60 * 60);
              reminderReason = `TAT overdue by ${Math.floor(hoursOverdue)} hours`;
            }
          } catch (e) {
            // Ignore parse errors
          }
        }

        if (!needsReminder) continue;

        // Get SPOC info
        if (!ticket.assigned_to) continue;

        // Send Slack reminder
        if (ticket.category_name === "Hostel" || ticket.category_name === "College") {
          try {
            const details = (ticket.metadata as any) || {};
            const slackMessageTs = details.slackMessageTs;
            if (slackMessageTs) {
              const { slackConfig } = await import("@/conf/config");
              // Note: subcategory name is not fetched, so we might miss subcategory specific CCs.
              // But for now, let's use category name.
              const ccUserIds =
                slackConfig.ccMap[ticket.category_name] ||
                slackConfig.defaultCc;

              const reminderText = `⏰ *Reminder*\n${reminderReason}\nTicket #${ticket.id} requires attention.\n${ticket.spoc_slack_id ? `<@${ticket.spoc_slack_id}>` : ""
                }`;

              const channelOverride = details.slackChannel;
              if (channelOverride) {
                await postThreadReplyToChannel(
                  channelOverride,
                  slackMessageTs,
                  reminderText,
                  ccUserIds
                );
              } else {
                const { postThreadReply } = await import("@/lib/slack");
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
            const emailBody = `Reminder: ${reminderReason}\n\nTicket #${ticket.id}\nCategory: ${ticket.category_name}\nUser Phone: ${ticket.user_number || "N/A"}\n\nPlease take action on this ticket.`;
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
