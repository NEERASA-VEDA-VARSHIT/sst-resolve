import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db, tickets } from "@/db";
import { eq } from "drizzle-orm";
import { sendEmail, getStatusUpdateEmail, getStudentEmail } from "@/lib/email";
import { postThreadReply } from "@/lib/slack";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    const role = sessionClaims?.metadata?.role;
    const isAdmin = role === "admin" || role === "super_admin";
    
    // Get ticket to check ownership
    const ticketId = parseInt(id);
    if (isNaN(ticketId)) {
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
    }

    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Check permissions: Admins can change any status, students can only reopen their own closed tickets
    if (!isAdmin) {
      // Students can only reopen (closed -> open) their own tickets
      if (status !== "open" || ticket.status !== "closed") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // Check if student owns this ticket
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      const userNumber = (user.publicMetadata as any)?.userNumber as string | undefined;

      if (!userNumber || userNumber !== ticket.userNumber) {
        return NextResponse.json({ error: "You can only reopen your own tickets" }, { status: 403 });
      }
    }

    if (status) {
      // Get original email Message-ID and subject BEFORE updating (to preserve them in details)
      let originalMessageId: string | undefined;
      let originalSubject: string | undefined;
      try {
        const ticketDetails = ticket.details ? JSON.parse(ticket.details) : {};
        originalMessageId = ticketDetails.originalEmailMessageId;
        originalSubject = ticketDetails.originalEmailSubject;
        if (originalMessageId) {
          console.log(`   🔗 Found original Message-ID for threading: ${originalMessageId}`);
        } else {
          console.warn(`   ⚠️ No originalEmailMessageId in ticket details for ticket #${ticketId}`);
        }
        if (originalSubject) {
          console.log(`   📝 Found original subject: ${originalSubject}`);
        }
      } catch (parseError) {
        console.warn(`⚠️ Could not parse ticket details for ticket #${ticketId}:`, parseError);
      }

      // Assign ticket to admin when they change status (if admin)
      const updateData: any = { status, updatedAt: new Date() };
      if (isAdmin) {
        updateData.assignedTo = userId; // Assign ticket to admin when they update status
      }
      
      // If closing/resolving a ticket, set ratingRequired to true
      if (status === "closed" || status === "resolved") {
        updateData.ratingRequired = "true";
      }
      
      const [updatedTicket] = await db
        .update(tickets)
        .set(updateData)
        .where(eq(tickets.id, ticketId))
        .returning();

      // Optional Slack notify on close
      if (updatedTicket && status === "closed") {
        const webhook = process.env.SLACK_WEBHOOK_URL;
        if (webhook) {
          try {
            await fetch(webhook, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: `✅ Ticket #${updatedTicket.id} marked closed\n• Category: ${updatedTicket.category} → ${updatedTicket.subcategory}\n• User: ${updatedTicket.userNumber}`,
              }),
            });
          } catch {}
        }
      }

      // Slack notification for ticket reopen
      if (updatedTicket && status === "open" && ticket.status === "closed") {
        try {
          const details = updatedTicket.details ? JSON.parse(updatedTicket.details) : {};
          const slackMessageTs = details.slackMessageTs;
          if (slackMessageTs && (updatedTicket.category === "Hostel" || updatedTicket.category === "College")) {
            const reopenText = isAdmin 
              ? `🔄 *Ticket Reopened*\n\nTicket #${updatedTicket.id} has been reopened by an admin.`
              : `🔄 *Ticket Reopened*\n\nTicket #${updatedTicket.id} has been reopened by the student.`;
            const { slackConfig } = await import("@/conf/config");
            const key = `${updatedTicket.category}${updatedTicket.subcategory ? ":" + updatedTicket.subcategory : ""}`;
            const ccUserIds = (slackConfig.ccMap[key] || slackConfig.ccMap[updatedTicket.category] || slackConfig.defaultCc);
            const channelOverride: string | undefined = typeof details.slackChannel === "string" ? details.slackChannel : undefined;
            if (channelOverride) {
              const { postThreadReplyToChannel } = await import("@/lib/slack");
              await postThreadReplyToChannel(channelOverride, slackMessageTs, reopenText, ccUserIds);
            } else {
              await postThreadReply(
                updatedTicket.category as "Hostel" | "College",
                slackMessageTs,
                reopenText,
                ccUserIds
              );
            }
          }
        } catch (error) {
          console.error("Error posting reopen notification to Slack:", error);
        }
      }

      // Send email notification to student for ALL status updates
      if (updatedTicket && status) {
        try {
          const studentEmail = await getStudentEmail(updatedTicket.userNumber);
          if (studentEmail) {
            // Use the originalMessageId we retrieved before the update
            const emailTemplate = getStatusUpdateEmail(
              updatedTicket.id,
              status,
              updatedTicket.category
            );
            const emailResult = await sendEmail({
              to: studentEmail,
              subject: emailTemplate.subject,
              html: emailTemplate.html,
              ticketId: updatedTicket.id,
              threadMessageId: originalMessageId,
              originalSubject: originalSubject,
            });
            
            if (!emailResult) {
              console.error(`❌ Failed to send status update email to ${studentEmail} for ticket #${updatedTicket.id}`);
            } else {
              console.log(`✅ Status update email sent to ${studentEmail} for ticket #${updatedTicket.id} (status: ${status})`);
            }
          } else {
            console.warn(`⚠️ No email found for user number: ${updatedTicket.userNumber} - status update email not sent`);
          }
        } catch (emailError) {
          console.error("Error sending status update email:", emailError);
          // Don't fail the request if email fails
        }
      }

      return NextResponse.json(updatedTicket);
    }

    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error updating ticket:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can delete tickets
    const role = sessionClaims?.metadata?.role;
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const ticketId = parseInt(id);
    if (isNaN(ticketId)) {
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
    }

    const result = await db
      .delete(tickets)
      .where(eq(tickets.id, ticketId))
      .returning();

    if (!result || result.length === 0) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting ticket:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

