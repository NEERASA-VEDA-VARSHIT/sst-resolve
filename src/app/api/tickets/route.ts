import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, tickets, users, categories } from "@/db";
import { desc, eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/db-roles";
import { createTicket } from "@/lib/tickets/createTicket";

/**
 * ============================================
 * /api/tickets
 * ============================================
 * 
 * POST → Create Ticket
 *   - Auth: Required (Student, Admin, Committee)
 *   - Creates new support ticket
 *   - Returns: 201 Created with ticket object
 * 
 * GET → List Tickets (role-based)
 *   - Student: Their tickets only
 *   - Admin: Assigned tickets + unassigned
 *   - Super Admin: All tickets
 *   - Committee: Committee-category tickets
 *   - Returns: 200 OK with paginated list
 * ============================================
 */

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const body = await request.json();
    
    // Use dynamic import to avoid circular dependency issues
    const { TicketCreateSchema } = await import("@/lib/validation/ticket");
    
    const parsed = TicketCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const ticket = await createTicket({
      clerkId: userId,
      payload: parsed.data,
    });

    // Process outbox events immediately for faster notifications
    // This ensures email and Slack notifications are sent right away
    // The cron job will still process any missed events as a backup
    try {
      const { processTicketCreated } = await import("@/workers/handlers/processTicketCreatedWorker");
      const { markOutboxSuccess, markOutboxFailure } = await import("@/workers/utils");
      const { db: dbInstance, outbox: outboxTable } = await import("@/db");
      const { eq, desc, and, isNull, sql } = await import("drizzle-orm");
      
      // Find the outbox event for this specific ticket using JSONB query
      const [outboxEvent] = await dbInstance
        .select()
        .from(outboxTable)
        .where(
          and(
            eq(outboxTable.event_type, "ticket.created"),
            isNull(outboxTable.processed_at),
            sql`${outboxTable.payload}->>'ticket_id' = ${ticket.id.toString()}`
          )
        )
        .orderBy(desc(outboxTable.created_at))
        .limit(1);
      
      if (outboxEvent && outboxEvent.payload) {
        // Ensure payload is a valid object
        let payload: any = {};
        try {
          if (typeof outboxEvent.payload === 'object' && outboxEvent.payload !== null && !Array.isArray(outboxEvent.payload)) {
            // Deep clone to avoid any reference issues
            payload = JSON.parse(JSON.stringify(outboxEvent.payload));
          } else {
            console.warn("[Ticket API] Invalid outbox payload type, using empty object:", typeof outboxEvent.payload);
            payload = {};
          }
        } catch (error) {
          console.error("[Ticket API] Error processing outbox payload:", error);
          payload = {};
        }
        
        // Process immediately (non-blocking to avoid delaying the response)
        processTicketCreated(outboxEvent.id, payload as any)
          .then(() => markOutboxSuccess(outboxEvent.id))
          .catch((error) => {
            console.error("[Ticket API] Failed to process outbox immediately:", error);
            console.error("[Ticket API] Error stack:", error instanceof Error ? error.stack : "No stack trace");
            markOutboxFailure(outboxEvent.id, error instanceof Error ? error.message : "Unknown error");
          });
      }
    } catch (error) {
      // Log but don't fail the request if immediate processing fails
      console.warn("[Ticket API] Could not process outbox immediately, cron will handle it:", error);
    }

    return NextResponse.json(ticket, { status: 201 });

  } catch (error) {
    console.error("Ticket creation failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = await getUserRoleFromDB(userId);

    // Query params: ?page=&limit=
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") || 1);
    const limit = Number(searchParams.get("limit") || 20);
    const offset = (page - 1) * limit;

    let results: typeof tickets.$inferSelect[] = [];

    //
    // -------------------------------
    // STUDENT → only their tickets
    // -------------------------------
    //
    if (role === "student") {
      const [userRow] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerk_id, userId))
        .limit(1);

      if (!userRow) return NextResponse.json([], { status: 200 });

      results = await db
        .select()
        .from(tickets)
        .where(eq(tickets.created_by, userRow.id))
        .orderBy(desc(tickets.created_at))
        .limit(limit)
        .offset(offset);
    }

    //
    // -------------------------------
    // ADMIN / SENIOR_ADMIN → assigned tickets
    // -------------------------------
    //
    else if (role === "admin") {
      const [userRow] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerk_id, userId))
        .limit(1);

      if (!userRow) {
        return NextResponse.json([], { status: 200 });
      }

      results = await db
        .select()
        .from(tickets)
        .where(eq(tickets.assigned_to, userRow.id))
        .orderBy(desc(tickets.created_at))
        .limit(limit)
        .offset(offset);
    }

    //
    // -------------------------------
    // COMMITTEE → ONLY "Committee" category tickets
    // -------------------------------
    //
    else if (role === "committee") {
      const [committeeCategory] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.name, "Committee"))
        .limit(1);

      if (!committeeCategory) {
        results = [];
      } else {
        results = await db
          .select()
          .from(tickets)
          .where(eq(tickets.category_id, committeeCategory.id))
          .orderBy(desc(tickets.created_at))
          .limit(limit)
          .offset(offset);
      }
    }

    //
    // -------------------------------
    // SUPER_ADMIN → all tickets
    // -------------------------------
    //
    else if (role === "super_admin") {
      results = await db
        .select()
        .from(tickets)
        .orderBy(desc(tickets.created_at))
        .limit(limit)
        .offset(offset);
    }

    //
    // Unknown role
    //
    else {
      results = [];
    }

    return NextResponse.json(results, { status: 200 });

  } catch (error) {
    console.error("Ticket fetch failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

