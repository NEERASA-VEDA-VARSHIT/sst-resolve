import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, tickets, ticket_groups, outbox, ticket_statuses } from "@/db";
import { eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import { getCanonicalStatus, TICKET_STATUS } from "@/conf/constants";
import { getStatusIdByValue } from "@/lib/status/getTicketStatuses";

// POST - Perform bulk actions on grouped tickets (comment, close, etc.)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
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

    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "Only admins and super admins can perform bulk actions" }, { status: 403 });
    }

    const { groupId } = await params;
    const groupIdNum = parseInt(groupId, 10);

    if (isNaN(groupIdNum)) {
      return NextResponse.json({ error: "Invalid group ID" }, { status: 400 });
    }

    const body = await request.json();
    const { action, comment, status } = body;

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    // Verify group exists
    const [group] = await db
      .select()
      .from(ticket_groups)
      .where(eq(ticket_groups.id, groupIdNum))
      .limit(1);

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Get all tickets in the group
    const groupTickets = await db
      .select({
        id: tickets.id,
        assigned_to: tickets.assigned_to,
        metadata: tickets.metadata,
        status_id: tickets.status_id,
        status_value: ticket_statuses.value,
      })
      .from(tickets)
      .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
      .where(eq(tickets.group_id, groupIdNum));

    if (groupTickets.length === 0) {
      return NextResponse.json({ error: "No tickets in this group" }, { status: 400 });
    }

    const results = [];
    let groupArchived = false;

    if (action === "comment") {
      // Add comment to all tickets
      if (!comment || !comment.trim()) {
        return NextResponse.json({ error: "Comment is required for comment action" }, { status: 400 });
      }

      // Edge case: Validate comment length (prevent extremely long comments)
      const COMMENT_MAX_LENGTH = 10000; // Match AddCommentSchema
      const trimmedComment = comment.trim();
      if (trimmedComment.length > COMMENT_MAX_LENGTH) {
        return NextResponse.json({ 
          error: `Comment exceeds maximum length of ${COMMENT_MAX_LENGTH} characters` 
        }, { status: 400 });
      }

      for (const ticket of groupTickets) {
        try {
          // Edge case: Verify ticket still exists before processing (may have been deleted)
          const [ticketExists] = await db
            .select({ id: tickets.id })
            .from(tickets)
            .where(eq(tickets.id, ticket.id))
            .limit(1);

          if (!ticketExists) {
            results.push({ ticketId: ticket.id, success: false, error: "Ticket was deleted during bulk operation" });
            continue;
          }

          // Parse existing metadata (not details)
          type TicketMetadata = {
            [key: string]: unknown;
          };
          let ticketMetadata: TicketMetadata = {};
          if (ticket.metadata) {
            try {
              ticketMetadata = typeof ticket.metadata === 'string' ? JSON.parse(ticket.metadata) : ticket.metadata;
            } catch (e) {
              console.error("Error parsing ticket metadata:", e);
            }
          }

          // Add comment to metadata
          if (!Array.isArray(ticketMetadata.comments)) {
            ticketMetadata.comments = [];
          }
          (ticketMetadata.comments as Array<Record<string, unknown>>).push({
            text: comment,
            author: "Admin",
            createdAt: new Date().toISOString(),
            source: "admin_dashboard",
            type: "student_visible",
            isInternal: false,
          });

          // Update ticket
          await db
            .update(tickets)
            .set({
              metadata: ticketMetadata,
              updated_at: new Date(),
            })
            .where(eq(tickets.id, ticket.id));

          // Insert into outbox for notification worker
          await db.insert(outbox).values({
            event_type: "ticket.comment_added",
            payload: {
              ticketId: ticket.id,
              comment: comment,
              authorName: "Admin",
              isInternal: false,
            },
            created_at: new Date(),
          });

          results.push({ ticketId: ticket.id, success: true });
        } catch (error) {
          console.error(`Error adding comment to ticket #${ticket.id}:`, error);
          results.push({ ticketId: ticket.id, success: false, error: String(error) });
        }
      }
    } else if (action === "close") {
      // Close all tickets
      const newStatusValue = getCanonicalStatus(status || TICKET_STATUS.RESOLVED) || TICKET_STATUS.RESOLVED;

      for (const ticket of groupTickets) {
        try {
          // Edge case: Verify ticket still exists before processing (may have been deleted)
          const [ticketExists] = await db
            .select({ id: tickets.id })
            .from(tickets)
            .where(eq(tickets.id, ticket.id))
            .limit(1);

          if (!ticketExists) {
            results.push({ ticketId: ticket.id, success: false, error: "Ticket was deleted during bulk operation" });
            continue;
          }

          const oldStatusValue = ticket.status_value || "";

          // Get status ID for new status
          const newStatusId = await getStatusIdByValue(newStatusValue);
          if (!newStatusId) {
            console.error(`Status ID not found for: ${newStatusValue}`);
            results.push({ ticketId: ticket.id, success: false, error: `Status "${newStatusValue}" not found` });
            continue;
          }

          // Update metadata with resolved_at
          let metadata: Record<string, unknown> = {};
          if (ticket.metadata && typeof ticket.metadata === 'object' && !Array.isArray(ticket.metadata)) {
            metadata = { ...ticket.metadata as Record<string, unknown> };
          }
          if (newStatusValue === TICKET_STATUS.RESOLVED) {
            metadata.resolved_at = new Date().toISOString();
          }

          await db
            .update(tickets)
            .set({
              status_id: newStatusId,
              metadata: metadata as unknown,
              updated_at: new Date(),
            })
            .where(eq(tickets.id, ticket.id));

          // Insert into outbox for notification worker
          await db.insert(outbox).values({
            event_type: "ticket.status_changed",
            payload: {
              ticketId: ticket.id,
                oldStatus: oldStatusValue,
                newStatus: newStatusValue,
              updatedBy: "Admin",
            },
            created_at: new Date(),
          });

          results.push({ ticketId: ticket.id, success: true });
        } catch (error) {
          console.error(`Error closing ticket #${ticket.id}:`, error);
          results.push({ ticketId: ticket.id, success: false, error: String(error) });
        }
      }

      // Check if all tickets in the group are now closed/resolved and archive if so
      const { checkAndArchiveGroupIfAllTicketsClosed } = await import("@/lib/archive/group-archive");
      groupArchived = await checkAndArchiveGroupIfAllTicketsClosed(groupIdNum);
    } else {
      return NextResponse.json({ error: "Invalid action. Supported actions: 'comment', 'close'" }, { status: 400 });
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: failureCount === 0,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount,
      },
      groupArchived: groupArchived || false,
    });
  } catch (error) {
    console.error("Error performing bulk action:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
