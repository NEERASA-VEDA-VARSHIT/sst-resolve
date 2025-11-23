import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, tickets, ticket_committee_tags, committees } from "@/db";
import { eq, and } from "drizzle-orm";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { fastAuthCheck, isAuthError } from "@/lib/auth/fast-auth";

/**
 * ============================================
 * /api/tickets/[id]/committee-tags
 * ============================================
 * 
 * GET → Get Committee Tags
 *   - Auth: Required (Admin, Committee)
 *   - List all committees tagged on this ticket
 *   - Returns: 200 OK with array of committee tags
 * 
 * POST → Add Committee Tag
 *   - Auth: Required (Admin only)
 *   - Tag a committee to handle the ticket
 *   - Body: { committeeId: number }
 *   - Returns: 201 Created with tag object
 * 
 * DELETE → Remove Committee Tag
 *   - Auth: Required (Admin only)
 *   - Remove committee tag via query param
 *   - Query: ?tagId=number
 *   - Returns: 200 OK with success message
 * ============================================
 */

// GET - Get all committee tags for a ticket
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Fast auth check (skips user sync for read operation)
    const authResult = await fastAuthCheck(["admin", "super_admin", "committee"]);
    
    // Return error response if auth failed
    if (isAuthError(authResult)) {
      return authResult;
    }

    const { id } = await params;
    const ticketId = parseInt(id, 10);

    if (isNaN(ticketId)) {
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
    }

    // Get all tags for this ticket with committee details
    const tags = await db
      .select({
        id: ticket_committee_tags.id,
        ticket_id: ticket_committee_tags.ticket_id,
        committee_id: ticket_committee_tags.committee_id,
        tagged_by: ticket_committee_tags.tagged_by,
        reason: ticket_committee_tags.reason,
        created_at: ticket_committee_tags.created_at,
        committee: {
          id: committees.id,
          name: committees.name,
          description: committees.description,
        },
      })
      .from(ticket_committee_tags)
      .innerJoin(committees, eq(ticket_committee_tags.committee_id, committees.id))
      .where(eq(ticket_committee_tags.ticket_id, ticketId));

    return NextResponse.json({ tags });
  } catch (error) {
    console.error("Error fetching committee tags:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST - Tag a ticket to a committee
export async function POST(
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
    
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "Only admins can tag tickets to committees" }, { status: 403 });
    }

    const { id } = await params;
    const ticketId = parseInt(id, 10);

    if (isNaN(ticketId)) {
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
    }

    const body = await request.json();
    const { committee_id, reason } = body;

    if (!committee_id) {
      return NextResponse.json({ error: "Committee ID is required" }, { status: 400 });
    }

    // Verify ticket exists
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Verify committee exists
    const [committee] = await db
      .select()
      .from(committees)
      .where(eq(committees.id, committee_id))
      .limit(1);

    if (!committee) {
      return NextResponse.json({ error: "Committee not found" }, { status: 404 });
    }

    // Check if tag already exists
    const [existingTag] = await db
      .select()
      .from(ticket_committee_tags)
      .where(
        and(
          eq(ticket_committee_tags.ticket_id, ticketId),
          eq(ticket_committee_tags.committee_id, committee_id)
        )
      )
      .limit(1);

    if (existingTag) {
      return NextResponse.json({ error: "Ticket is already tagged to this committee" }, { status: 400 });
    }

    // Ensure user exists in database
    const dbUser = await getOrCreateUser(userId);

    if (!dbUser) {
      return NextResponse.json({ error: "Failed to sync user" }, { status: 500 });
    }

    // Create the tag
    const [newTag] = await db
      .insert(ticket_committee_tags)
      .values({
        ticket_id: ticketId,
        committee_id,
        tagged_by: dbUser.id,
        reason: reason || null,
      })
      .returning();

    // Fetch tag with committee details
    const [tagWithCommittee] = await db
      .select({
        id: ticket_committee_tags.id,
        ticket_id: ticket_committee_tags.ticket_id,
        committee_id: ticket_committee_tags.committee_id,
        tagged_by: ticket_committee_tags.tagged_by,
        reason: ticket_committee_tags.reason,
        created_at: ticket_committee_tags.created_at,
        committee: {
          id: committees.id,
          name: committees.name,
          description: committees.description,
        },
      })
      .from(ticket_committee_tags)
      .innerJoin(committees, eq(ticket_committee_tags.committee_id, committees.id))
      .where(eq(ticket_committee_tags.id, newTag.id))
      .limit(1);

    return NextResponse.json({ tag: tagWithCommittee }, { status: 201 });
  } catch (error) {
    console.error("Error tagging ticket:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE - Remove a committee tag from a ticket
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
    
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "Only admins can remove committee tags" }, { status: 403 });
    }

    const { id } = await params;
    const ticketId = parseInt(id, 10);

    if (isNaN(ticketId)) {
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const tagId = searchParams.get("tagId");
    const committeeId = searchParams.get("committeeId");

    if (!tagId && !committeeId) {
      return NextResponse.json({ error: "Either tagId or committeeId is required" }, { status: 400 });
    }

    let deleteQuery = db.delete(ticket_committee_tags).where(eq(ticket_committee_tags.ticket_id, ticketId));

    if (tagId) {
      const tagIdNum = parseInt(tagId, 10);
      if (isNaN(tagIdNum)) {
        return NextResponse.json({ error: "Invalid tag ID" }, { status: 400 });
      }
      deleteQuery = db.delete(ticket_committee_tags).where(eq(ticket_committee_tags.id, tagIdNum));
    } else if (committeeId) {
      const committeeIdNum = parseInt(committeeId, 10);
      if (isNaN(committeeIdNum)) {
        return NextResponse.json({ error: "Invalid committee ID" }, { status: 400 });
      }
      deleteQuery = db
        .delete(ticket_committee_tags)
        .where(
          and(
            eq(ticket_committee_tags.ticket_id, ticketId),
            eq(ticket_committee_tags.committee_id, committeeIdNum)
          )
        );
    }

    await deleteQuery;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing committee tag:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

