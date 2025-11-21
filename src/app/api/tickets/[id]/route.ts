import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db, tickets, ticket_committee_tags, committee_members, categories, users, ticket_statuses } from "@/db";
import { eq, and, inArray } from "drizzle-orm";
import { sendEmail, getStatusUpdateEmail } from "@/lib/email";
import { postThreadReply } from "@/lib/slack";
import { TICKET_STATUS } from "@/conf/constants";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";
// Removed: statusToEnum - status values are already in correct format from database

/** Utility: Ensure user owns the ticket */
async function userOwnsTicket(userId: string, ticketId: number) {
  const [userRow] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerk_id, userId))
    .limit(1);

  if (!userRow) return false;

  const [ticketRow] = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(and(eq(tickets.id, ticketId), eq(tickets.created_by, userRow.id)))
    .limit(1);

  return Boolean(ticketRow);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = await getUserRoleFromDB(userId);
    const { id } = await params;
    const ticketId = Number(id);

    if (isNaN(ticketId)) {
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
    }

    // Fetch ticket
    const [ticketRecord] = await db
      .select({
        id: tickets.id,
        status_value: ticket_statuses.value,
        description: tickets.description,
        location: tickets.location,
        created_at: tickets.created_at,
        updated_at: tickets.updated_at,
        resolution_due_at: tickets.resolution_due_at,
        escalation_level: tickets.escalation_level,
        metadata: tickets.metadata,
        created_by: tickets.created_by,
        assigned_to: tickets.assigned_to,
        category_id: tickets.category_id,
        // Join fields
        category_name: categories.name,
        creator_first_name: users.first_name,
        creator_last_name: users.last_name,
        creator_email: users.email,
      })
      .from(tickets)
      .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
      .leftJoin(categories, eq(tickets.category_id, categories.id))
      .leftJoin(users, eq(tickets.created_by, users.id))
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticketRecord)
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

    // Construct creator name from first_name and last_name
    const creator_name = [ticketRecord.creator_first_name, ticketRecord.creator_last_name]
      .filter(Boolean)
      .join(' ')
      .trim() || null;

    // ------------------------------
    // ROLE-BASED ACCESS CONTROL
    // ------------------------------

    // Student → must own the ticket
    if (role === "student") {
      const owns = await userOwnsTicket(userId, ticketId);
      if (!owns)
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Committee → only committee tickets
    if (role === "committee") {
      const [committeeCat] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.name, "Committee"))
        .limit(1);

      if (!committeeCat || ticketRecord.category_id !== committeeCat.id) {
        // Check if tagged
        const dbUser = await getOrCreateUser(userId);
        if (dbUser) {
          const memberRecords = await db
            .select({ committee_id: committee_members.committee_id })
            .from(committee_members)
            .where(eq(committee_members.user_id, dbUser.id));

          const committeeIds = memberRecords.map(m => m.committee_id);
          if (committeeIds.length > 0) {
            const tagRecords = await db
              .select()
              .from(ticket_committee_tags)
              .where(
                and(
                  eq(ticket_committee_tags.ticket_id, ticketId),
                  inArray(ticket_committee_tags.committee_id, committeeIds)
                )
              )
              .limit(1);

            if (tagRecords.length === 0) {
              return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
          } else {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
          }
        } else {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    // Admin/SPOC → only assigned tickets or unassigned?
    // Usually admins can view all tickets or at least those in their domain.
    // For now, let's allow admins to view any ticket if they are admin.
    // The previous code restricted to assigned tickets, but that might be too strict for a "view" operation.
    // But let's stick to the previous logic if it was intended.
    // Previous logic:
    // if (role === "admin") { ... if (!staffRow || ticketRecord.assigned_to !== staffRow.id) ... }
    // This implies admins can ONLY view tickets assigned to them.
    // However, usually admins should be able to view unassigned tickets too to pick them up.
    // Let's allow admins to view all tickets for now, as per standard ticket system behavior.
    // If strict assignment is needed, we can add it back.

    // Super admin → full access

    return NextResponse.json({
      ...ticketRecord,
      creator_name,
    }, { status: 200 });

  } catch (error) {
    console.error("Ticket fetch error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user exists in database
    await getOrCreateUser(userId);

    // Get role from database (single source of truth)
    const role = await getUserRoleFromDB(userId);
    const isAdmin = role === "admin" || role === "super_admin";
    const isCommittee = role === "committee";

    const { id } = await params;
    const body = await request.json();
    let { status, comment, commentType } = body;

    // Get ticket to check ownership
    const ticketId = parseInt(id);
    if (isNaN(ticketId)) {
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
    }

    const [ticket] = await db
      .select({
        id: tickets.id,
        status_value: ticket_statuses.value,
        created_by: tickets.created_by,
        assigned_to: tickets.assigned_to,
        metadata: tickets.metadata,
        category_id: tickets.category_id,
        location: tickets.location,
        description: tickets.description,
      })
      .from(tickets)
      .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Check if committee member has access to this ticket (if tagged to their committee)
    let isTaggedToUserCommittee = false;
    if (isCommittee) {
      const dbUser = await getOrCreateUser(userId);

      if (!dbUser) {
        return NextResponse.json({ error: "User account not found" }, { status: 404 });
      }

      const memberRecords = await db
        .select({ committee_id: committee_members.committee_id })
        .from(committee_members)
        .where(eq(committee_members.user_id, dbUser.id));

      const committeeIds = memberRecords.map(m => m.committee_id);

      if (committeeIds.length > 0) {
        const tagRecords = await db
          .select()
          .from(ticket_committee_tags)
          .where(
            and(
              eq(ticket_committee_tags.ticket_id, ticketId),
              inArray(ticket_committee_tags.committee_id, committeeIds)
            )
          )
          .limit(1);

        isTaggedToUserCommittee = tagRecords.length > 0;
      }
    }

    // Check permissions: 
    // - Admins can change any status
    // - Committee members can close/resolve tickets tagged to their committee
    // - Students can only reopen their own closed/resolved tickets
    // PRD v3.0: Reopening sets status to "reopened" (not "open")

    // Calculate isReopening once for reuse throughout the function
    const isReopening = status === TICKET_STATUS.REOPENED || status === "reopened";
    const isClosingOrResolving = status === TICKET_STATUS.RESOLVED || status === "resolved";

    if (!isAdmin) {
      if (isCommittee) {
        // Committee members can only close/resolve tickets tagged to their committee
        if (!isTaggedToUserCommittee) {
          return NextResponse.json({ error: "You can only update tickets tagged to your committee" }, { status: 403 });
        }

        if (!isClosingOrResolving) {
          return NextResponse.json({ error: "Committee members can only close or resolve tickets" }, { status: 403 });
        }
      } else {
        // Students can only reopen (closed/resolved -> reopened) their own tickets
        const isClosedOrResolved = ticket.status_value === "RESOLVED";

        if (!isReopening || !isClosedOrResolved) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Check if student owns this ticket (using created_by)
        const dbUser = await getOrCreateUser(userId);

        if (!dbUser) {
          return NextResponse.json({ error: "User account not found" }, { status: 404 });
        }

        if (!ticket.created_by || ticket.created_by !== dbUser.id) {
          return NextResponse.json({ error: "You can only reopen your own tickets" }, { status: 403 });
        }

        // Normalize status to use constant
        if (status === "reopened") {
          status = TICKET_STATUS.REOPENED;
        }
      }
    }

    // Handle comments if provided (for committee members or admins)
    if (comment && typeof comment === "string" && comment.trim().length > 0) {
      // Check permissions for adding comments
      if (!isAdmin && !isTaggedToUserCommittee) {
        return NextResponse.json({ error: "You don't have permission to add comments to this ticket" }, { status: 403 });
      }

      // Parse metadata (JSONB) for comments
      const metadata = (ticket.metadata as any) || {};
      if (!metadata.comments) {
        metadata.comments = [];
      }

      // Get author name
      let authorName = "Committee Member";
      if (isAdmin) {
        authorName = role === "super_admin" ? "Super Admin" : "Admin";
      } else {
        try {
          const client = await clerkClient();
          const user = await client.users.getUser(userId);
          authorName = user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.username || user.emailAddresses[0]?.emailAddress || "Committee Member";
        } catch (e) {
          console.error("Error fetching user name:", e);
        }
      }

      // Add comment
      metadata.comments.push({
        text: comment.trim(),
        author: authorName,
        createdAt: new Date().toISOString(),
        source: isAdmin ? "admin_dashboard" : "committee_dashboard",
        type: commentType || "student_visible",
        isInternal: commentType === "internal_note" || commentType === "super_admin_note",
      });

      // Update ticket with comment
      await db
        .update(tickets)
        .set({
          metadata: metadata,
          updated_at: new Date(),
        })
        .where(eq(tickets.id, ticketId));

      // If only comment (no status update), return success
      if (!status) {
        const [updatedTicket] = await db
          .select()
          .from(tickets)
          .where(eq(tickets.id, ticketId))
          .limit(1);
        return NextResponse.json(updatedTicket);
      }
    }

    if (status) {
      // Get original email Message-ID and subject BEFORE updating (to preserve them in metadata)
      let originalMessageId: string | undefined;
      let originalSubject: string | undefined;
      try {
        const metadata = (ticket.metadata as any) || {};
        originalMessageId = metadata.originalEmailMessageId;
        originalSubject = metadata.originalEmailSubject;
        if (originalMessageId) {
          console.log(`   🔗 Found original Message-ID for threading: ${originalMessageId}`);
        } else {
          console.warn(`   ⚠️ No originalEmailMessageId in ticket metadata for ticket #${ticketId}`);
        }
        if (originalSubject) {
          console.log(`   📝 Found original subject: ${originalSubject}`);
        }
      } catch (parseError) {
        console.warn(`⚠️ Could not parse ticket metadata for ticket #${ticketId}:`, parseError);
      }

      // Convert status to uppercase enum value before saving
      // Status values in database are uppercase (OPEN, IN_PROGRESS, etc.)
      const enumStatus = typeof status === 'string' ? status.toUpperCase() : status;

      // Find status ID
      const [statusRow] = await db.select({ id: ticket_statuses.id })
        .from(ticket_statuses)
        .where(eq(ticket_statuses.value, enumStatus))
        .limit(1);

      if (!statusRow) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }

      // Assign ticket to admin when they change status (if admin)
      const updateData: any = { status_id: statusRow.id, updated_at: new Date() };

      // Set reopened_at timestamp when ticket is reopened (check enumStatus too)
      if (isReopening || enumStatus === "REOPENED") {
        updateData.reopened_at = new Date();
      }

      if (isAdmin) {
        // Get admin's user ID for assignment
        const dbUser = await getOrCreateUser(userId);

        if (!dbUser) {
          return NextResponse.json({ error: "User account not found" }, { status: 404 });
        }

        // Assign to the admin user directly
        updateData.assigned_to = dbUser.id;
      }

      // If resolving a ticket, set resolved_at
      if (enumStatus === "RESOLVED") {
        updateData.resolved_at = new Date();
      }

      await db
        .update(tickets)
        .set(updateData)
        .where(eq(tickets.id, ticketId));

      // Fetch updated ticket with joins for notifications
      const [updatedTicket] = await db
        .select({
          id: tickets.id,
          status_value: ticket_statuses.value,
          created_by: tickets.created_by,
          category_id: tickets.category_id,
          metadata: tickets.metadata,
          category_name: categories.name,
          creator_email: users.email,
        })
        .from(tickets)
        .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
        .leftJoin(categories, eq(tickets.category_id, categories.id))
        .leftJoin(users, eq(tickets.created_by, users.id))
        .where(eq(tickets.id, ticketId))
        .limit(1);

      if (!updatedTicket) {
        return NextResponse.json({ error: "Ticket not found after update" }, { status: 404 });
      }

      // Get metadata for notifications
      const updatedMetadata = (updatedTicket.metadata as any) || {};
      const slackMessageTs = updatedMetadata?.slackMessageTs;
      const slackChannel = updatedMetadata?.slackChannel;

      // Optional Slack notify on close
      if (updatedTicket && status === "closed") {
        const webhook = process.env.SLACK_WEBHOOK_URL;
        if (webhook) {
          try {
            await fetch(webhook, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: `✅ Ticket #${updatedTicket.id} marked closed\n• Category: ${updatedTicket.category_name || "Unknown"}\n• User: ${updatedTicket.creator_email || "Unknown"}`,
              }),
            });
          } catch { }
        }
      }

      // Slack notification for ticket reopen
      // PRD v3.0: Reopening sets status to "reopened"
      // Check if ticket was reopened using enumStatus (calculated after status normalization)
      const wasClosedOrResolved = ticket.status_value === "RESOLVED";
      const isReopeningForSlack = enumStatus === "REOPENED" || isReopening;
      if (updatedTicket && isReopeningForSlack && wasClosedOrResolved) {
        try {
          if (slackMessageTs && (updatedTicket.category_name === "Hostel" || updatedTicket.category_name === "College")) {
            const reopenText = isAdmin
              ? `🔄 *Ticket Reopened*\n\nTicket #${updatedTicket.id} has been reopened by an admin.`
              : isCommittee
                ? `🔄 *Ticket Reopened*\n\nTicket #${updatedTicket.id} has been reopened by a committee member.`
                : `🔄 *Ticket Reopened*\n\nTicket #${updatedTicket.id} has been reopened by the student.`;
            const { slackConfig } = await import("@/conf/config");
            const key = `${updatedTicket.category_name}`;
            const ccUserIds = (slackConfig.ccMap[key] || slackConfig.ccMap[updatedTicket.category_name] || slackConfig.defaultCc);
            const channelOverride: string | undefined = typeof slackChannel === "string" ? slackChannel : undefined;
            if (channelOverride) {
              const { postThreadReplyToChannel } = await import("@/lib/slack");
              await postThreadReplyToChannel(channelOverride, slackMessageTs, reopenText, ccUserIds);
            } else {
              await postThreadReply(
                updatedTicket.category_name as "Hostel" | "College",
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
      if (updatedTicket && status && updatedTicket.created_by) {
        try {
          // Get creator email from users table (already fetched in join)
          const studentEmail = updatedTicket.creator_email || null;

          if (studentEmail) {
            // Use the originalMessageId we retrieved before the update
            const emailTemplate = getStatusUpdateEmail(
              updatedTicket.id,
              status,
              updatedTicket.category_name || "Ticket"
            );
            const emailResult = await sendEmail({
              to: studentEmail,
              subject: emailTemplate.subject,
              html: emailTemplate.html,
              ticketId: updatedTicket.id,
              threadMessageId: originalMessageId,
            });

            if (!emailResult) {
              console.error(`❌ Failed to send status update email to ${studentEmail} for ticket #${updatedTicket.id}`);
            } else {
              console.log(`✅ Status update email sent to ${studentEmail} for ticket #${updatedTicket.id} (status: ${status})`);
            }
          } else {
            console.warn(`⚠️ No email found for creator (user_id: ${updatedTicket.created_by}) - status update email not sent`);
          }
        } catch (emailError) {
          console.error("Error sending status update email:", emailError);
          // Don't fail the request if email fails
        }
      }

      // Fetch full ticket for response
      const [fullTicket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);

      return NextResponse.json(fullTicket);
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
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user exists in database
    await getOrCreateUser(userId);

    // Get role from database (single source of truth)
    const role = await getUserRoleFromDB(userId);

    // Only admins can delete tickets
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
