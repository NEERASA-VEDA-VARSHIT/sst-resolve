import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, tickets } from "@/db";
import { eq } from "drizzle-orm";
import { postThreadReplyToChannel } from "@/lib/slack";
import { sendEmail, getStudentEmail } from "@/lib/email";

/**
 * POST /api/tickets/[id]/acknowledge
 * SPOC acknowledges a ticket and optionally sets acknowledgement TAT
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can acknowledge tickets
    const role = (sessionClaims as any)?.metadata?.role;
    const isAdmin = role === "admin" || role === "super_admin";

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Only admins can acknowledge tickets" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const ticketId = parseInt(id);

    if (isNaN(ticketId)) {
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
    }

    const body = await request.json();
    const { message, acknowledgementTat } = body || {};

    // Get current ticket
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Check if ticket is assigned to this admin (or unassigned)
    if (ticket.assignedTo && ticket.assignedTo !== userId) {
      return NextResponse.json(
        { error: "You can only acknowledge tickets assigned to you" },
        { status: 403 }
      );
    }

    // Check if already acknowledged
    if (ticket.acknowledgedAt) {
      return NextResponse.json(
        { error: "Ticket already acknowledged" },
        { status: 400 }
      );
    }

    // Get admin name
    let adminName = "Admin";
    try {
      const { clerkClient } = await import("@clerk/nextjs/server");
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      adminName =
        user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.emailAddresses[0]?.emailAddress || "Admin";
    } catch (e) {
      console.error("Error fetching admin name:", e);
    }

    // Parse existing details
    let details: any = {};
    if (ticket.details) {
      try {
        details = JSON.parse(ticket.details);
      } catch (e) {
        console.error("Error parsing details:", e);
      }
    }

    // Add acknowledgement comment
    if (!details.comments) {
      details.comments = [];
    }
    details.comments.push({
      text: message || "Ticket acknowledged by SPOC",
      author: adminName,
      createdAt: new Date().toISOString(),
      source: "web",
      type: "student_visible",
      isInternal: false,
    });

    // Update ticket
    const updateData: any = {
      acknowledgedAt: new Date(),
      acknowledgedBy: userId,
      assignedTo: ticket.assignedTo || userId, // Auto-assign if not already assigned
      updatedAt: new Date(),
      details: JSON.stringify(details),
    };

    if (acknowledgementTat) {
      updateData.acknowledgementTat = acknowledgementTat;
    }

    await db.update(tickets).set(updateData).where(eq(tickets.id, ticketId));

    // Send Slack notification
    if (ticket.category === "Hostel" || ticket.category === "College") {
      const slackMessageTs = details.slackMessageTs;
      if (slackMessageTs) {
        try {
          const { slackConfig } = await import("@/conf/config");
          const ccUserIds =
            slackConfig.ccMap[
              `${ticket.category}${ticket.subcategory ? ":" + ticket.subcategory : ""}`
            ] ||
            slackConfig.ccMap[ticket.category] ||
            slackConfig.defaultCc;

          const ackText = `✅ *Ticket Acknowledged*\nTicket #${ticketId} has been acknowledged by ${adminName}.\n${
            message ? `Message: ${message}\n` : ""
          }${acknowledgementTat ? `Acknowledgement TAT: ${acknowledgementTat}` : ""}`;

          const channelOverride = details.slackChannel;
          if (channelOverride) {
            await postThreadReplyToChannel(
              channelOverride,
              slackMessageTs,
              ackText,
              ccUserIds
            );
          } else {
            const { postThreadReply } = await import("@/lib/slack");
            await postThreadReply(
              ticket.category as "Hostel" | "College",
              slackMessageTs,
              ackText,
              ccUserIds
            );
          }
          console.log(
            `✅ Posted acknowledgement to Slack thread for ticket #${ticketId}`
          );
        } catch (slackError) {
          console.error(
            `❌ Error posting acknowledgement to Slack for ticket #${ticketId}:`,
            slackError
          );
        }
      }
    }

    // Send email notification to student
    try {
      const studentEmail = await getStudentEmail(ticket.userNumber);
      if (studentEmail) {
        const emailSubject = `Ticket #${ticketId} Acknowledged`;
        const emailBody = `Your ticket #${ticketId} has been acknowledged by ${adminName}.\n\n${
          message || "We are working on resolving your issue."
        }`;
        
        // Get original email details for threading
        const originalMessageId = details.originalEmailMessageId;
        const originalSubject = details.originalEmailSubject;
        
        await sendEmail({
          to: studentEmail,
          subject: emailSubject,
          html: emailBody.replace(/\n/g, '<br>'),
          ticketId,
          threadMessageId: originalMessageId,
          originalSubject,
        });
        console.log(
          `✅ Sent acknowledgement email to ${studentEmail} for ticket #${ticketId}`
        );
      }
    } catch (emailError) {
      console.error(
        `❌ Error sending acknowledgement email for ticket #${ticketId}:`,
        emailError
      );
    }

    return NextResponse.json({
      success: true,
      message: "Ticket acknowledged successfully",
    });
  } catch (error) {
    console.error("Error acknowledging ticket:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

