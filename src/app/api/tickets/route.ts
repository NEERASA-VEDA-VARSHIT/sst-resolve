import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, tickets, users, categories } from "@/db";
import { desc, eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { createTicket } from "@/lib/ticket/createTicket";

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

    // Process outbox events asynchronously (non-blocking)
    // This ensures email and Slack notifications are sent without delaying the response
    // The cron job will still process any missed events as a backup
    // Fire and forget - don't await this
    void (async () => {
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
        
        if (!outboxEvent) {
          console.warn(`[Ticket API] No outbox event found for ticket #${ticket.id}. Email will be sent by cron job.`);
          return;
        }
        
        if (outboxEvent && outboxEvent.payload) {
          console.log(`[Ticket API] Found outbox event ${outboxEvent.id} for ticket #${ticket.id}`);
          // Ensure payload is a valid object
          type TicketCreatedPayload = {
            ticket_id: number;
            created_by_clerk?: string;
            category?: string;
            [key: string]: unknown;
          };
          let payload: TicketCreatedPayload = { ticket_id: 0 };
          try {
            if (typeof outboxEvent.payload === 'object' && outboxEvent.payload !== null && !Array.isArray(outboxEvent.payload)) {
              // Deep clone to avoid any reference issues
              const parsed = JSON.parse(JSON.stringify(outboxEvent.payload)) as Record<string, unknown>;
              // Map ticketId to ticket_id if needed
              payload = {
                ticket_id: typeof parsed.ticket_id === 'number' ? parsed.ticket_id :
                          typeof parsed.ticketId === 'number' ? parsed.ticketId : 0,
                created_by_clerk: typeof parsed.created_by_clerk === 'string' ? parsed.created_by_clerk : undefined,
                category: typeof parsed.category === 'string' ? parsed.category : undefined,
                ...parsed
              };
            } else {
              console.warn("[Ticket API] Invalid outbox payload type, using empty object:", typeof outboxEvent.payload);
              payload = { ticket_id: 0 };
            }
          } catch (error) {
            console.error("[Ticket API] Error processing outbox payload:", error);
            payload = { ticket_id: 0 };
          }
          
          // Process immediately (non-blocking)
          console.log(`[Ticket API] Processing outbox event ${outboxEvent.id} for ticket #${payload.ticket_id}`);
          processTicketCreated(outboxEvent.id, payload)
            .then(() => {
              console.log(`[Ticket API] ✅ Successfully processed outbox event ${outboxEvent.id}`);
              return markOutboxSuccess(outboxEvent.id);
            })
            .catch((error) => {
              console.error(`[Ticket API] ❌ Failed to process outbox event ${outboxEvent.id}:`, error);
              console.error("[Ticket API] Error stack:", error instanceof Error ? error.stack : "No stack trace");
              return markOutboxFailure(outboxEvent.id, error instanceof Error ? error.message : "Unknown error");
            });
        }
      } catch (error) {
        // Log but don't fail the request if immediate processing fails
        console.warn("[Ticket API] Could not process outbox immediately, cron will handle it:", error);
      }
    });

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

