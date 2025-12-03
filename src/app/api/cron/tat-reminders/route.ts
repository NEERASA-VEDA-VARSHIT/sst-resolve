import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tickets, users, categories, ticket_statuses } from "@/db/schema";
import { and, gte, lt, ne, eq, aliasedTable } from "drizzle-orm";
import { sendEmail } from "@/lib/integration/email";
import { postToSlackChannel } from "@/lib/integration/slack";
import { TICKET_STATUS } from "@/conf/constants";
import { verifyCronAuth } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { getStatusIdByValue } from "@/lib/status/getTicketStatuses";

const envEnabled = (value: string | undefined) => value === undefined || value !== "false";

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
    // Verify cron authentication (mandatory in production)
    const authError = verifyCronAuth(request);
    if (authError) {
      return authError;
    }

    logger.info("[TAT Cron] Starting TAT reminder job");

    const tatEnabled = envEnabled(process.env.ENABLE_TAT_REMINDERS);
    const slackEnabled = envEnabled(process.env.ENABLE_SLACK_NOTIFICATIONS);
    const emailEnabled = envEnabled(process.env.ENABLE_EMAIL_NOTIFICATIONS);

    if (!tatEnabled) {
      logger.info("[TAT Cron] TAT reminders are disabled in settings. Skipping.");
      return NextResponse.json({ message: "TAT reminders disabled" });
    }

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Skip weekends (Saturday = 6, Sunday = 0)
    const dayOfWeek = today.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      logger.info("[TAT Cron] Today is weekend (Sat/Sun). Skipping TAT reminders.");
      return NextResponse.json({
        success: true,
        message: "Weekend - TAT reminders skipped",
      });
    }


    // Use regular joins instead of relational query API
    const assignedUser = aliasedTable(users, "assigned_user");
    
    const resolvedStatusId = await getStatusIdByValue(TICKET_STATUS.RESOLVED);
    const whereConditions = [
      gte(tickets.resolution_due_at, today),
      lt(tickets.resolution_due_at, tomorrow),
    ];
    if (resolvedStatusId) {
      whereConditions.push(ne(tickets.status_id, resolvedStatusId));
    }

    const dueTicketRows = await db
      .select({
        id: tickets.id,
        description: tickets.description,
        location: tickets.location,
        status: ticket_statuses.value,
        category_id: tickets.category_id,
        subcategory_id: tickets.subcategory_id,
        sub_subcategory_id: tickets.sub_subcategory_id,
        created_by: tickets.created_by,
        assigned_to: tickets.assigned_to,
        escalation_level: tickets.escalation_level,
        acknowledgement_due_at: tickets.acknowledgement_due_at,
        resolution_due_at: tickets.resolution_due_at,
        metadata: tickets.metadata,
        created_at: tickets.created_at,
        updated_at: tickets.updated_at,
        category_name: categories.name,
        assigned_user_id: assignedUser.id,
        assigned_user_email: assignedUser.email,
        assigned_user_full_name: assignedUser.full_name,
      })
      .from(tickets)
      .leftJoin(ticket_statuses, eq(ticket_statuses.id, tickets.status_id))
      .leftJoin(categories, eq(tickets.category_id, categories.id))
      .leftJoin(assignedUser, eq(tickets.assigned_to, assignedUser.id))
      .where(and(...whereConditions));

    // Transform to match expected structure
    const dueTickets = dueTicketRows.map(t => ({
      ...t,
      category: t.category_name ? { name: t.category_name } : null,
      assigned_admin: t.assigned_user_id ? {
        full_name: t.assigned_user_full_name || null,
        user: {
          email: t.assigned_user_email || null,
        },
      } : null,
      due_at: t.resolution_due_at,
      assigned_to: t.assigned_to,
    }));


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
        const adminIdStr = String(adminId);
        if (!acc[adminIdStr]) acc[adminIdStr] = [];
        acc[adminIdStr].push(ticket);
        return acc;
      }, {} as Record<string, typeof dueTickets>);

      for (const [, adminTickets] of Object.entries(ticketsByAdmin)) {
        const admin = adminTickets[0]?.assigned_admin;
        if (!admin || !admin.user?.email) continue;

        const adminName = admin.full_name || "Admin";
        try {
          const emailHtml = renderTATReminderEmail(adminTickets, adminName);
          await sendEmail({
            to: admin.user.email,
            subject: `⏰ TAT Reminder: ${adminTickets.length} ticket(s) due today`,
            html: emailHtml,
          });
          remindersSent++;
        } catch (error) {
          console.error(`[TAT Cron] Failed to send email to ${adminName}:`, error);
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
          remindersSent++;

        } catch (error) {
          console.error(`[TAT Cron] Failed to send Slack to ${channelKey}:`, error);
        }
      }
    }


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

interface TATReminderTicket {
  id: number;
  description?: string | null;
  category?: { name?: string | null } | null;
  due_at?: Date | string | null;
  resolution_due_at?: Date | string | null;
}
function renderTATReminderEmail(tickets: TATReminderTicket[], adminName: string): string {
  const ticketList = tickets
    .map(
      (t) => `
      <div class="ticket">
        <strong>Ticket #${t.id}</strong><br>
        ${t.description ? (typeof t.description === 'string' ? t.description.substring(0, 50) : 'Ticket') : "No description"}<br>
        <span class="category">Category: ${t.category?.name || "Unknown"}</span><br>
        <span class="due">Due: ${(t.due_at || t.resolution_due_at ? new Date(t.due_at || t.resolution_due_at || '').toLocaleString() : 'N/A')}</span>
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

interface SlackTATReminderTicket {
  description?: string | null;
  id: number;
  assigned_admin?: { full_name?: string | null } | null;
}
function formatSlackTATReminder(tickets: SlackTATReminderTicket[], categoryName: string): string {
  // Group by Admin Name
  const ticketsByAdmin = tickets.reduce((acc: Record<string, SlackTATReminderTicket[]>, ticket: SlackTATReminderTicket) => {
    const adminName = ticket.assigned_admin?.full_name || "Unassigned";
    if (!acc[adminName]) acc[adminName] = [];
    acc[adminName].push(ticket);
    return acc;
  }, {});

  let message = `⏰ *TAT Reminder - ${categoryName}*\n\nThe following tickets are due today:\n`;

  // Base URL for links
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
    (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : 
    (process.env.NODE_ENV === 'production' ? null : 'http://localhost:3000'));
  
  if (!baseUrl && process.env.NODE_ENV === 'production') {
    console.error("[TAT Cron] NEXT_PUBLIC_APP_URL must be set in production");
  }

  for (const [adminName, adminTickets] of Object.entries(ticketsByAdmin)) {
    message += `\n👤 *${adminName}*\n`;
    adminTickets.forEach((t: SlackTATReminderTicket) => {
      const ticketUrl = `${baseUrl}/admin/dashboard/ticket/${t.id}`;
      const ticketDesc = t.description ? (typeof t.description === 'string' ? t.description.substring(0, 50) : 'Ticket') : "No description";
      message += ` • <${ticketUrl}|#${t.id}> - ${ticketDesc}\n`;
    });
  }

  message += `\nPlease review them immediately.`;
  return message;
}
