import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tickets, users, outbox, ticket_statuses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AddCommentSchema } from "@/schema/ticket.schema";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";
import { auth } from "@clerk/nextjs/server";
import type { TicketMetadata } from "@/db/types";

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

// Utility – Get local DB user
async function getLocalUserId(clerkId: string) {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerk_id, clerkId))
    .limit(1);

  return row?.id ?? null;
}

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

    const role = await getUserRoleFromDB(userId);
    const ticket = await loadTicket(ticketId);

    if (!ticket)
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

    // Student → only if they own the ticket
    if (role === "student") {
      const localId = await getLocalUserId(userId);
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

    // Ensure local user exists
    const localUser = await getOrCreateUser(userId);
    if (!localUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const role = await getUserRoleFromDB(userId);
    const isAdminUser = role === "admin" || role === "super_admin";
    const isCommittee = role === "committee";
    const isStudent = role === "student";

    // Load ticket
    const [ticket] = await db
      .select({
        id: tickets.id,
        metadata: tickets.metadata,
        created_by: tickets.created_by,
        status_value: ticket_statuses.value,
        category_id: tickets.category_id,
      })
      .from(tickets)
      .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
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
      // keep behavior: committee members should only add student-visible comments (internal notes are admin-only)
      if (commentType !== "student_visible") {
        return NextResponse.json({ error: "Committee members cannot add internal notes" }, { status: 403 });
      }
      // committee membership tagging check should be enforced separately if needed (worker/admin will handle)
    } else if (!isAdminUser) {
      // unknown/unsupported roles blocked
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Build author name (prefer local user name if available)
    const authorName = [localUser.first_name, localUser.last_name].filter(Boolean).join(' ').trim();
    const author = authorName || localUser.email || "User";
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

    // Transaction: append comment to metadata.comments and insert outbox event
    const updated = await db.transaction(async (tx) => {
      // Reload metadata inside transaction to avoid race
      const [freshTicket] = await tx
        .select({ metadata: tickets.metadata })
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);

      const metadata = (freshTicket?.metadata as TicketMetadata & { comments?: Array<Record<string, unknown>> }) || {};
      if (!Array.isArray(metadata.comments)) metadata.comments = [];
      metadata.comments.push(commentObj);

      // Update ticket metadata (and update_at)
      await tx
        .update(tickets)
        .set({
          metadata,
          updated_at: new Date(),
          // optionally change status for student replies, e.g. set to IN_PROGRESS – worker or caller may handle
        })
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

    return NextResponse.json({ success: true, comment: updated }, { status: 201 });
  } catch (error) {
    console.error("Error adding comment:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
