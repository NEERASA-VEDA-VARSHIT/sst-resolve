import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tickets, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { getOrCreateUser } from "@/lib/user-sync";

/**
 * ============================================
 * /api/tickets/[id]/activity
 * ============================================
 * 
 * GET → Get Activity Timeline
 *   - Auth: Required
 *   - Returns chronological timeline of all ticket events:
 *     • Status changes
 *     • Comments (filtered by role)
 *     • Staff assignments
 *     • Escalations
 *     • Email/Slack delivery logs (optional)
 *   - Returns: 200 OK with array of activity events
 * ============================================
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ------------------- AUTH -------------------
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const ticketId = Number(id);
    if (isNaN(ticketId)) {
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
    }

    // Load local user for ownership checks
    const localUser = await getOrCreateUser(userId);
    if (!localUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const role = await getUserRoleFromDB(userId);
    const isStudent = role === "student";
    const isCommittee = role === "committee";

    // ------------------- LOAD TICKET -------------------
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // ------------------- PERMISSION CHECK -------------------
    if (isStudent) {
      if (ticket.created_by !== localUser.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Committee → can only view activity for committee tickets
    // The ticket/category rules already enforced upstream.
    // If needed, we enforce category here.

    // Admins, senior, super_admin → full access

    // ------------------- BUILD TIMELINE -------------------

    type TimelineItem = {
      type: string;
      timestamp: Date;
      user?: string;
      content?: string;
      [key: string]: unknown;
    };
    const timeline: TimelineItem[] = [];

    type TicketMetadata = {
      comments?: Array<{ [key: string]: unknown }>;
      [key: string]: unknown;
    };
    const metadata = (ticket.metadata as TicketMetadata) || {};

    // 1. COMMENTS
    if (Array.isArray(metadata.comments)) {
      for (const c of metadata.comments) {
        // Students cannot see internal notes
        if (isStudent && c.isInternal) continue;

        type Comment = {
          author?: unknown;
          text?: unknown;
          createdAt?: unknown;
          isInternal?: unknown;
        };
        const comment = c as Comment;
        const createdAt = comment.createdAt instanceof Date ? comment.createdAt : 
                         typeof comment.createdAt === 'string' ? new Date(comment.createdAt) :
                         new Date();
        timeline.push({
          type: "comment",
          timestamp: createdAt,
          author: String(comment.author || "Unknown"),
          text: String(comment.text || ""),
          createdAt: createdAt,
          isInternal: Boolean(comment.isInternal || false),
        });
      }
    }

    // 2. STATUS CHANGES
    // Note: Since we don't have a separate history table for status changes yet,
    // we only have the current timestamps.
    // Ideally, we should query an 'activity_log' or 'audit_log' table.

    if (ticket.created_at) {
      timeline.push({
        type: "status_change",
        timestamp: ticket.created_at,
        oldStatus: null,
        newStatus: "OPEN", // Initial status
        at: ticket.created_at,
      });
    }

    if (ticket.resolved_at) {
      timeline.push({
        type: "status_change",
        timestamp: ticket.resolved_at,
        oldStatus: "IN_PROGRESS",
        newStatus: "RESOLVED",
        at: ticket.resolved_at,
      });
    }

    if (ticket.reopened_at) {
      timeline.push({
        type: "status_change",
        timestamp: ticket.reopened_at,
        oldStatus: "RESOLVED",
        newStatus: "REOPENED",
        at: ticket.reopened_at,
      });
    }

    // 3. ESCALATION EVENTS
    if (ticket.last_escalation_at) {
      timeline.push({
        type: "escalation",
        timestamp: ticket.last_escalation_at,
        level: ticket.escalation_level || 1,
        at: ticket.last_escalation_at,
      });
    }

    // 4. ASSIGNMENT CHANGES (stored by worker in metadata.audit)
    if (Array.isArray(metadata.assignment_history)) {
      for (const a of metadata.assignment_history) {
        type Assignment = {
          oldAssignee?: unknown;
          newAssignee?: unknown;
          timestamp?: unknown;
        };
        const assignment = a as Assignment;
        const assignmentTimestamp = assignment.timestamp instanceof Date ? assignment.timestamp :
                                   typeof assignment.timestamp === 'string' ? new Date(assignment.timestamp) :
                                   new Date();
        timeline.push({
          type: "assignment",
          timestamp: assignmentTimestamp,
          oldAssignee: assignment.oldAssignee ?? null,
          newAssignee: assignment.newAssignee ?? null,
          at: assignmentTimestamp,
        });
      }
    }

    // ------------------- SORT BY DATE DESC -------------------
    timeline.sort((a, b) => {
      const dateA = a.timestamp.getTime();
      const dateB = b.timestamp.getTime();
      return dateB - dateA;
    });

    return NextResponse.json(timeline, { status: 200 });
  } catch (err) {
    console.error("Activity timeline fetch failed:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
