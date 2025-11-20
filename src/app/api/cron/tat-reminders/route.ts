import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tickets, notification_settings } from "@/db/schema";
import { and, gte, lt, ne, eq } from "drizzle-orm";
import { sendEmail } from "@/lib/email";
import { postToSlackChannel } from "@/lib/slack";

/**
 * TAT Reminder Cron Job
 * Runs daily at 9 AM to remind admins of tickets due today
 * 
 * Setup in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/tat-reminders",
 *     "schedule": "0 9 * * *"
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error("[TAT Cron] Unauthorized access attempt");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[TAT Cron] Starting TAT reminder job");

    // Fetch notification settings
    const [settings] = await db.select().from(notification_settings).limit(1);

    // Default to enabled if no settings found (fail safe)
    const tatEnabled = settings ? settings.tat_reminders_enabled : true;
    const slackEnabled = settings ? settings.slack_enabled : true;
    const emailEnabled = settings ? settings.email_enabled : true;

    if (!tatEnabled) {
      console.log("[TAT Cron] TAT reminders are disabled in settings. Skipping.");
      return NextResponse.json({ message: "TAT reminders disabled" });
    }

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log("[TAT Cron] Checking tickets due between", {
      start: today.toISOString(),
      end: tomorrow.toISOString(),
    });

    // Find tickets due today that are not resolved
    const dueTickets = await db.query.tickets.findMany({
      where: and(
        gte(tickets.due_at, today),
        lt(tickets.due_at, tomorrow),
        ne(tickets.status, "RESOLVED")
      ),
      with: {
        assigned_admin: {
          with: {
            user: true,
          },
        },
        category: true,
      },
    });

    console.log(`[TAT Cron] Found ${dueTickets.length} tickets due today`);

    if (dueTickets.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No tickets due today",
        reminders_sent: 0,
      });
    }

    let remindersSent = 0;

    // 1. Send Email Reminders (Grouped by Admin)
    if (emailEnabled) {
      const ticketsByAdmin = dueTickets.reduce((acc, ticket) => {
        const adminId = ticket.assigned_to;
        if (!adminId) return acc;
        if (!acc[adminId]) acc[adminId] = [];
        acc[adminId].push(ticket);
        return acc;
      }, {} as Record<number, typeof dueTickets>);

      for (const [adminId, adminTickets] of Object.entries(ticketsByAdmin)) {
        const admin = adminTickets[0].assigned_admin;
        if (!admin) continue;

        try {
          const emailHtml = renderTATReminderEmail(adminTickets, admin.full_name);
          await sendEmail({
            to: admin.user.email,
            subject: `⏰ TAT Reminder: ${adminTickets.length} ticket(s) due today`,
            html: emailHtml,
          });
          console.log(`[TAT Cron] Email sent to ${admin.user.email}`);
          remindersSent++;
        } catch (error) {
          console.error(`[TAT Cron] Failed to send email to ${admin.full_name}:`, error);
        }
      }
    }

    // 2. Send Slack Reminders (Grouped by Category -> Admin)
    if (slackEnabled) {
      // Group tickets by Category Name (Hostel, College, etc.)
      const ticketsByCategory = dueTickets.reduce((acc, ticket) => {
        const categoryName = ticket.category?.name || "Uncategorized";
        if (!acc[categoryName]) acc[categoryName] = [];
        acc[categoryName].push(ticket);
        return acc;
      }, {} as Record<string, typeof dueTickets>);

      for (const [categoryName, categoryTickets] of Object.entries(ticketsByCategory)) {
        // Map category name to Slack channel key
        let channelKey: "Hostel" | "College" | "Committee" = "College";
        if (categoryName.toLowerCase().includes("hostel")) channelKey = "Hostel";
        else if (categoryName.toLowerCase().includes("committee")) channelKey = "Committee";

        try {
          // Channel Summary
          const slackMessage = formatSlackTATReminder(categoryTickets, categoryName);
          await postToSlackChannel(channelKey, slackMessage);
          console.log(`[TAT Cron] Slack summary sent to ${channelKey} for ${categoryName}`);
          remindersSent++;

        } catch (error) {
          console.error(`[TAT Cron] Failed to send Slack to ${channelKey}:`, error);
        }
      }
    }

    console.log(`[TAT Cron] Completed. Sent ${remindersSent} reminders`);

    return NextResponse.json({
      success: true,
      reminders_sent: remindersSent,
      tickets_due: dueTickets.length,
    });
  } catch (error) {
    console.error("[TAT Cron] Error in TAT reminder job:", error);
    return NextResponse.json(
      { error: "Internal server error", message: (error as Error).message },
      { status: 500 }
    );
  }
}

function renderTATReminderEmail(tickets: any[], adminName: string): string {
  const ticketList = tickets
    .map(
      (t) => `
      <div class="ticket">
        <strong>Ticket #${t.id}</strong><br>
        ${t.title || "No title"}<br>
        <span class="category">Category: ${t.category?.name || "Unknown"}</span><br>
        <span class="due">Due: ${new Date(t.due_at).toLocaleString()}</span>
      </div>
    `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header { 
            background-color: #f59e0b; 
            color: white; 
            padding: 20px; 
            text-align: center; 
            border-radius: 5px 5px 0 0; 
          }
          .content { 
            background-color: #f9fafb; 
            padding: 20px; 
            border: 1px solid #e5e7eb; 
          }
          .ticket { 
            background: #fef3c7; 
            padding: 15px; 
            margin: 10px 0; 
            border-left: 4px solid #f59e0b; 
            border-radius: 4px;
          }
          .category { 
            color: #6b7280; 
            font-size: 14px; 
          }
          .due { 
            color: #dc2626; 
            font-weight: bold; 
            font-size: 14px; 
          }
          .footer { 
            text-align: center; 
            padding: 20px; 
            color: #6b7280; 
            font-size: 12px; 
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>⏰ TAT Reminder</h1>
        </div>
        <div class="content">
          <p>Hi ${adminName},</p>
          <p>You have <strong>${tickets.length} ticket(s)</strong> due today that require your attention:</p>
          ${ticketList}
          <p>Please review and update these tickets as soon as possible.</p>
        </div>
        <div class="footer">
          <p>This is an automated reminder from SST Resolve</p>
        </div>
      </body>
    </html>
  `;
}

function formatSlackTATReminder(tickets: any[], categoryName: string): string {
  // Group by Admin Name
  const ticketsByAdmin = tickets.reduce((acc: any, ticket: any) => {
    const adminName = ticket.assigned_admin?.full_name || "Unassigned";
    if (!acc[adminName]) acc[adminName] = [];
    acc[adminName].push(ticket);
    return acc;
  }, {});

  let message = `⏰ *TAT Reminder - ${categoryName}*\n\nThe following tickets are due today:\n`;

  // Base URL for links
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : 'http://localhost:3000');

  for (const [adminName, adminTickets] of Object.entries(ticketsByAdmin)) {
    message += `\n👤 *${adminName}*\n`;
    // @ts-ignore
    adminTickets.forEach((t: any) => {
      const ticketUrl = `${baseUrl}/admin/dashboard/ticket/${t.id}`;
      message += ` • <${ticketUrl}|#${t.id}> - ${t.title || "No title"}\n`;
    });
  }

  message += `\nPlease review them immediately.`;
  return message;
}
