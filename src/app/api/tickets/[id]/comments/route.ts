import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tickets, outbox, ticket_statuses } from "@/db/schema";
import type { TicketInsert } from "@/db/inferred-types";
import { eq } from "drizzle-orm";
import { AddCommentSchema } from "@/schemas/business/ticket";
import { getCachedAdminUser, getCachedUser, getCachedTicketStatuses } from "@/lib/cache/cached-queries";
import { auth } from "@clerk/nextjs/server";
import type { TicketMetadata } from "@/db/inferred-types";
import { TICKET_STATUS, getCanonicalStatus } from "@/conf/constants";

/**
 * ============================================
 * /api/tickets/[id]/comments
 * ============================================
 * 
 * POST → Add Comment
 *   - Auth: Required
 *   - Student comments: Public, visible to all
 *   - Admin comments: Can be public or internal
 *   - Committee internal notes: Only visible to committee + admins
 *   - Super Admin internal notes: Visible to all staff
 *   - Returns: 201 Created with comment object
 * 
 * GET → List All Comments
 *   - Auth: Required
 *   - Students: See only public comments
 *   - Staff: See public + internal notes
 *   - Returns: 200 OK with array of comments
 * ============================================
 */

// Utility – Load ticket
async function loadTicket(ticketId: number) {
  const [row] = await db
    .select()
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);
  return row ?? null;
}

//
// ---------------------------------------------------------
// GET → return all comments
// ---------------------------------------------------------
//
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const ticketId = Number(id);
    if (isNaN(ticketId))
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });

    // Use cached function for better performance (request-scoped deduplication)
    // Try admin cache first, fallback to generic user cache
    let role, localId;
    try {
      const adminResult = await getCachedAdminUser(userId);
      role = adminResult.role;
      localId = adminResult.dbUser.id;
    } catch {
      // Fallback for non-admin users
      const user = await getCachedUser(userId);
      localId = user.id;
      const { getUserRoleFromDB } = await import("@/lib/auth/db-roles");
      role = await getUserRoleFromDB(userId);
    }
    
    const ticket = await loadTicket(ticketId);

    if (!ticket)
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

    // Student → only if they own the ticket
    if (role === "student") {
      if (!localId || ticket.created_by !== localId)
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      const metadata = (ticket.metadata as TicketMetadata & { comments?: Array<Record<string, unknown>> }) || {};
      const comments = (metadata.comments || []).filter(
        (c: Record<string, unknown>) => !c.isInternal
      );

      return NextResponse.json(comments, { status: 200 });
    }

    // Committee / Staff / Admin / Superadmin → all comments
    const metadata = (ticket.metadata as TicketMetadata & { comments?: Array<Record<string, unknown>> }) || {};
    const comments = metadata.comments || [];

    return NextResponse.json(comments, { status: 200 });
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tickets/[id]/comments
 * - Validates input
 * - Checks permissions
 * - Appends comment to ticket.metadata.comments in a DB transaction
 * - Enqueues an outbox event ('ticket.comment.added') for notifications (Slack/email)
 *
 * NOTE: Worker must process outbox events to send Slack/email and update ticket metadata further if needed.
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate payload
    const body = await request.json();
    const parsed = AddCommentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }
    const { comment, commentType } = parsed.data; // e.g. "student_visible" | "internal_note" | "super_admin_note"

    const { id } = await params;
    const ticketId = Number(id);
    if (isNaN(ticketId)) {
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
    }

    // Use cached function for better performance (request-scoped deduplication)
    // Try admin cache first, fallback to generic user cache
    let localUser, role;
    try {
      const adminResult = await getCachedAdminUser(userId);
      localUser = adminResult.dbUser;
      role = adminResult.role;
    } catch {
      // Fallback for non-admin users
      localUser = await getCachedUser(userId);
      const { getUserRoleFromDB } = await import("@/lib/auth/db-roles");
      role = await getUserRoleFromDB(userId);
    }
    if (!localUser) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const isAdminUser = role === "admin" || role === "super_admin";
    const isCommittee = role === "committee";
    const isStudent = role === "student";

    // Load ticket
    const [ticket] = await db
      .select({
        id: tickets.id,
        metadata: tickets.metadata,
        created_by: tickets.created_by,
        status: ticket_statuses.value,
        category_id: tickets.category_id,
      })
      .from(tickets)
      .leftJoin(ticket_statuses, eq(ticket_statuses.id, tickets.status_id))
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

    // Permission rules
    if (isStudent) {
      if (!ticket.created_by || ticket.created_by !== localUser.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // students cannot add internal notes
      if (commentType !== "student_visible") {
        return NextResponse.json({ error: "Students cannot add internal notes" }, { status: 403 });
      }
      
      // Check if the last comment was from a student - if so, prevent adding another comment
      const metadata = (ticket.metadata as TicketMetadata & { comments?: Array<Record<string, unknown>> }) || {};
      const comments = Array.isArray(metadata.comments) ? metadata.comments : [];
      if (comments.length > 0) {
        const lastComment = comments[comments.length - 1];
        const lastCommentSource = lastComment?.source;
        // If last comment was from a student (source === "website"), prevent adding another comment
        if (lastCommentSource === "website") {
          return NextResponse.json({ 
            error: "You have already replied. Please wait for the admin to ask another question before replying again." 
          }, { status: 403 });
        }
      }
    } else if (isCommittee) {
      // Edge case: Validate committee member has access to this ticket
      const { canCommitteeAccessTicket } = await import("@/lib/ticket/utils/committeeAccess");
      const hasAccess = await canCommitteeAccessTicket(ticketId, localUser.id);
      if (!hasAccess) {
        return NextResponse.json({ error: "You can only comment on tickets tagged to your committee or tickets you created" }, { status: 403 });
      }

      // keep behavior: committee members should only add student-visible comments (internal notes are admin-only)
      if (commentType !== "student_visible") {
        return NextResponse.json({ error: "Committee members cannot add internal notes" }, { status: 403 });
      }
    } else if (!isAdminUser) {
      // unknown/unsupported roles blocked
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Build author name (prefer local user name if available)
    const author = localUser.full_name || localUser.email || "User";
    // For admin super_admin note type, we may label differently in the worker / UI

    // Create comment object
    const isInternal = commentType === "internal_note" || commentType === "super_admin_note";
    const commentObj = {
      text: comment.trim(),
      author,
      createdAt: new Date().toISOString(),
      source: isAdminUser ? "admin_dashboard" : "website",
      type: commentType,
      isInternal,
    };

    // Transaction: append comment to metadata.comments, handle TAT resume, and auto status change
    let updated;
    try {
      updated = await db.transaction(async (tx) => {
      // Reload ticket with status inside transaction to avoid race
      const [freshTicket] = await tx
        .select({ 
          metadata: tickets.metadata,
          status: ticket_statuses.value,
        })
        .from(tickets)
        .leftJoin(ticket_statuses, eq(ticket_statuses.id, tickets.status_id))
        .where(eq(tickets.id, ticketId))
        .limit(1);

      if (!freshTicket) throw new Error("Ticket not found in transaction");

      // Safely parse and validate metadata structure
      let metadata: TicketMetadata & { comments?: Array<Record<string, unknown>> };
      try {
        if (freshTicket.metadata && typeof freshTicket.metadata === 'object' && !Array.isArray(freshTicket.metadata)) {
          metadata = freshTicket.metadata as TicketMetadata & { comments?: Array<Record<string, unknown>> };
        } else {
          metadata = {};
        }
      } catch (parseError) {
        console.error(`[Comments API] Error parsing metadata for ticket #${ticketId}:`, parseError);
        // Start with fresh metadata if parsing fails
        metadata = {};
      }
      
      // Ensure comments array exists and is valid
      if (!Array.isArray(metadata.comments)) {
        metadata.comments = [];
      }
      
      // Validate comment object before pushing
      if (commentObj && typeof commentObj === 'object' && commentObj.text && typeof commentObj.text === 'string') {
        metadata.comments.push(commentObj);
      } else {
        throw new Error("Invalid comment object structure");
      }

      const updateData: Partial<TicketInsert> = {
        metadata: metadata as unknown,
        updated_at: new Date(),
      };

      // Check if student is replying to AWAITING_STUDENT status
      const statusValue = freshTicket.status || null;
      const currentStatus = statusValue ? (getCanonicalStatus(statusValue) || statusValue.toLowerCase()) : "";
      const isAwaitingStudent =
        currentStatus === TICKET_STATUS.AWAITING_STUDENT;
      
      if (isStudent && isAwaitingStudent) {
        // 1. Resume TAT - calculate paused duration and update TAT date
        const tatPauseStart = metadata.tatPauseStart ? new Date(metadata.tatPauseStart as string) : null;
        const now = new Date();
        
        if (tatPauseStart && metadata.tatDate) {
          // Calculate paused duration
          const pausedDuration = now.getTime() - tatPauseStart.getTime();
          const previousPausedDuration = (metadata.tatPausedDuration as number) || 0;
          metadata.tatPausedDuration = previousPausedDuration + pausedDuration;
          
          // Update TAT date by adding paused duration
          const originalTATDate = new Date(metadata.tatDate as string);
          const newTATDate = new Date(originalTATDate.getTime() + pausedDuration);
          metadata.tatDate = newTATDate.toISOString();
          
          // Clear pause start
          metadata.tatPauseStart = undefined;
          
          // Create TAT_RESUME event
          await tx.insert(outbox).values({
            event_type: "TAT_RESUME",
            payload: {
              ticket_id: ticketId,
              paused_duration_ms: pausedDuration,
              total_paused_duration_ms: metadata.tatPausedDuration,
              new_tat_date: metadata.tatDate,
              resumed_at: now.toISOString(),
            },
          });
        }

        // 2. Automatically change status to IN_PROGRESS
        // Use cached statuses for better performance
        const ticketStatuses = await getCachedTicketStatuses();
        const inProgressStatus = ticketStatuses.find(s => s.value.toLowerCase() === TICKET_STATUS.IN_PROGRESS.toLowerCase());
        const inProgressStatusId = inProgressStatus?.id || null;
        if (inProgressStatusId) {
          updateData.status_id = inProgressStatusId;
        } else {
          console.error(`[Comments API] Failed to find status_id for "${TICKET_STATUS.IN_PROGRESS}"`);
        }
        
        // Create status change event
        await tx.insert(outbox).values({
          event_type: "ticket.status.updated",
          payload: {
            ticket_id: ticketId,
            old_status: currentStatus ? currentStatus.toUpperCase() : currentStatus,
            new_status: TICKET_STATUS.IN_PROGRESS.toUpperCase(),
            updated_by_clerk_id: userId,
            auto_changed: true,
            reason: "Student replied to awaiting question",
          },
        });
      }

      // Update ticket
      await tx
        .update(tickets)
        .set(updateData)
        .where(eq(tickets.id, ticketId));

      // Enqueue outbox event for worker to send Slack/email/threaded replies
      await tx.insert(outbox).values({
        event_type: "ticket.comment.added",
        payload: {
          ticket_id: ticketId,
          comment: commentObj,
          added_by_clerk_id: userId,
          originalEmailMessageId: metadata.originalEmailMessageId || null,
          originalEmailSubject: metadata.originalEmailSubject || null,
          category_id: ticket.category_id || null,
        },
      });

        return commentObj;
      });
    } catch (transactionError) {
      console.error(`[Comments API] Transaction failed for ticket #${ticketId}:`, transactionError);
      
      // Handle specific transaction errors
      if (transactionError instanceof Error) {
        if (transactionError.message.includes('deadlock') || transactionError.message.includes('timeout')) {
          return NextResponse.json(
            { error: "Database operation timed out. Please try again." },
            { status: 503 }
          );
        }
        if (transactionError.message.includes('not found') || transactionError.message.includes('does not exist')) {
          return NextResponse.json(
            { error: "Ticket not found. It may have been deleted." },
            { status: 404 }
          );
        }
        if (transactionError.message.includes('Invalid comment')) {
          return NextResponse.json(
            { error: "Invalid comment data. Please try again." },
            { status: 400 }
          );
        }
      }
      
      // Re-throw for generic error handling
      throw transactionError;
    }

    return NextResponse.json({ success: true, comment: updated }, { status: 201 });
  } catch (error) {
    console.error("Error adding comment:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
