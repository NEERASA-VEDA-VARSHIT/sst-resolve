import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tickets, users, staff } from "@/db/schema";
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
  { params }: { params: { id: string } }
) {
  try {
    // ------------------- AUTH -------------------
    const { userId } = await auth();
    if (isNaN(ticketId)) {
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
    }

    // Load local user for ownership checks
    const localUser = await getOrCreateUser(userId);

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

    if (isCommittee) {
      // Committee can only view activity for committee tickets
      // The ticket/category rules already enforced upstream.
      // If needed, we enforce category here.
    }

    // Admins, senior, super_admin → full access

    // ------------------- BUILD TIMELINE -------------------

    const timeline: any[] = [];

    const metadata = (ticket.metadata as any) || {};

    // 1. COMMENTS
    if (Array.isArray(metadata.comments)) {
      for (const c of metadata.comments) {
        // Students cannot see internal notes
        if (isStudent && c.isInternal) continue;

        timeline.push({
          type: "comment",
          author: c.author || "Unknown",
          text: c.text || "",
          createdAt: c.createdAt,
          isInternal: c.isInternal || false,
        });
      }
    }

    // 2. STATUS CHANGES
    if (ticket.created_at) {
      timeline.push({
        type: "status_change",
        oldStatus: null,
        newStatus: ticket.status || "OPEN",
        at: ticket.created_at,
      });
    }

    if (ticket.resolved_at) {
      timeline.push({
        type: "status_change",
        oldStatus: "IN_PROGRESS",
        newStatus: "RESOLVED",
        at: ticket.resolved_at,
      });
    }

    if (ticket.reopened_at) {
      timeline.push({
        type: "status_change",
        oldStatus: "RESOLVED",
        newStatus: "REOPENED",
        at: ticket.reopened_at,
      });
    }

    // 3. ESCALATION EVENTS
    if (ticket.last_escalation_at) {
      timeline.push({
        type: "escalation",
        level: ticket.escalation_level || 1,
        at: ticket.last_escalation_at,
      });
    }

    // 4. ASSIGNMENT CHANGES (stored by worker in metadata.audit)
    if (Array.isArray(metadata.assignment_history)) {
      for (const a of metadata.assignment_history) {
        timeline.push({
          type: "assignment",
          oldAssignee: a.oldAssignee ?? null,
          newAssignee: a.newAssignee ?? null,
          at: a.timestamp,
        });
      }
    }

    // ------------------- SORT BY DATE DESC -------------------
    timeline.sort((a, b) => {
      const dateA = new Date(a.at || a.createdAt || 0).getTime();
      const dateB = new Date(b.at || b.createdAt || 0).getTime();
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
