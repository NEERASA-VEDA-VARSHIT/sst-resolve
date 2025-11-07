import { NextRequest, NextResponse } from "next/server";
import { db, tickets, staff } from "@/db";
import { eq, and, or, isNull, lt } from "drizzle-orm";
import { postThreadReplyToChannel } from "@/lib/slack";
import { sendEmail, getStudentEmail } from "@/lib/email";

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

    // Find all open/in_progress tickets that:
    // 1. Are assigned to a SPOC
    // 2. Have not been acknowledged OR have TAT that is due/overdue
    const pendingTickets = await db
      .select()
      .from(tickets)
      .where(
        and(
          or(
            eq(tickets.status, "open"),
            eq(tickets.status, "in_progress"),
            eq(tickets.status, "awaiting_student_response"),
            eq(tickets.status, "reopened")
          ),
          or(eq(tickets.assignedTo, ""), isNull(tickets.assignedTo)) // Only unassigned or assigned tickets
        )
      );

    for (const ticket of pendingTickets) {
      try {
        // Check if ticket needs reminder
        let needsReminder = false;
        let reminderReason = "";

        // Case 1: Not acknowledged and created more than 2 hours ago
        if (!ticket.acknowledgedAt && ticket.createdAt) {
          const hoursSinceCreation =
            (now.getTime() - new Date(ticket.createdAt).getTime()) / (1000 * 60 * 60);
          if (hoursSinceCreation >= 2) {
            needsReminder = true;
            reminderReason = `Ticket not acknowledged (created ${Math.floor(hoursSinceCreation)} hours ago)`;
          }
        }

        // Case 2: Acknowledged but TAT is due/overdue
        if (ticket.acknowledgedAt && ticket.details) {
          try {
            const details = JSON.parse(ticket.details);
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
        let spocUserId = ticket.assignedTo;
        if (!spocUserId) continue;

        // Get staff info for Slack mention
        const [spocStaff] = await db
          .select()
          .from(staff)
          .where(eq(staff.clerkUserId, spocUserId))
          .limit(1);

        // Send Slack reminder
        if (ticket.category === "Hostel" || ticket.category === "College") {
          try {
            const details = ticket.details ? JSON.parse(ticket.details) : {};
            const slackMessageTs = details.slackMessageTs;
            if (slackMessageTs) {
              const { slackConfig } = await import("@/conf/config");
              const ccUserIds =
                slackConfig.ccMap[
                  `${ticket.category}${ticket.subcategory ? ":" + ticket.subcategory : ""}`
                ] ||
                slackConfig.ccMap[ticket.category] ||
                slackConfig.defaultCc;

              const reminderText = `⏰ *Reminder*\n${reminderReason}\nTicket #${ticket.id} requires attention.\n${
                spocStaff?.slackUserId ? `<@${spocStaff.slackUserId}>` : ""
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
                  ticket.category as "Hostel" | "College",
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
        if (spocStaff?.email) {
          try {
            const emailSubject = `Reminder: Ticket #${ticket.id} Requires Attention`;
            const emailBody = `Reminder: ${reminderReason}\n\nTicket #${ticket.id}\nCategory: ${ticket.category}\nSubcategory: ${ticket.subcategory}\nUser: ${ticket.userNumber}\n\nPlease take action on this ticket.`;
            await sendEmail({
              to: spocStaff.email,
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

