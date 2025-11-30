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
      return NextResponse.json(
        { error: "Unauthorized" }, 
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    
    // Parse request body with error handling
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("[Ticket API] Failed to parse request body:", parseError);
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    
    // Use dynamic import to avoid circular dependency issues
    const { TicketCreateSchema } = await import("@/lib/validation/ticket");
    
    const parsed = TicketCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Create ticket with specific error handling
    let ticket;
    try {
      ticket = await createTicket({
        clerkId: userId,
        payload: parsed.data,
      });
    } catch (createError) {
      console.error("[Ticket API] createTicket failed:", createError);
      const errorMessage = createError instanceof Error 
        ? createError.message 
        : typeof createError === 'string' 
          ? createError 
          : "Failed to create ticket";
      
      // Return appropriate status code based on error type
      const statusCode = errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")
        ? 403
        : errorMessage.includes("not found") || errorMessage.includes("Invalid")
        ? 400
        : 500;
      
      return NextResponse.json(
        { error: errorMessage },
        { status: statusCode }
      );
    }

    // Process outbox events asynchronously (non-blocking)
    // This ensures email and Slack notifications are sent without delaying the response
    // The cron job will still process any missed events as a backup
    // Fire and forget - don't await this
    (async () => {
      try {
        console.log(`[Ticket API] 🔔 Starting async notification processing for ticket #${ticket.id}`);
        
        // Small delay to ensure transaction is committed
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const { processTicketCreated } = await import("@/workers/handlers/processTicketCreatedWorker");
        const { markOutboxSuccess, markOutboxFailure } = await import("@/workers/utils");
        const { db: dbInstance, outbox: outboxTable } = await import("@/db");
        const { eq, desc, and, isNull, sql } = await import("drizzle-orm");
        
        console.log(`[Ticket API] 🔍 Searching for outbox event for ticket #${ticket.id}`);
        
        // Find the outbox event for this specific ticket using JSONB query
        // Only look for unprocessed events
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
        
        let eventToProcess = outboxEvent;
        
        if (!eventToProcess) {
          console.warn(`[Ticket API] ⚠️ No unprocessed outbox event found for ticket #${ticket.id}. This might be a race condition - retrying...`);
          // Wait a bit and retry once (race condition handling)
          await new Promise(resolve => setTimeout(resolve, 500));
          const [retryEvent] = await dbInstance
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
          
          if (!retryEvent) {
            console.warn(`[Ticket API] ⚠️ Still no outbox event after retry for ticket #${ticket.id}. Cron job will handle it.`);
            return;
          }
          eventToProcess = retryEvent;
          console.log(`[Ticket API] ✅ Found outbox event ${eventToProcess.id} after retry for ticket #${ticket.id}`);
        } else {
          console.log(`[Ticket API] ✅ Found outbox event ${eventToProcess.id} for ticket #${ticket.id}`);
        }
        
        if (eventToProcess && eventToProcess.payload) {
          // Ensure payload is a valid object
          type TicketCreatedPayload = {
            ticket_id: number;
            created_by_clerk?: string;
            category?: string;
            [key: string]: unknown;
          };
          let payload: TicketCreatedPayload = { ticket_id: 0 };
          try {
            if (typeof eventToProcess.payload === 'object' && eventToProcess.payload !== null && !Array.isArray(eventToProcess.payload)) {
              // Deep clone to avoid any reference issues
              const parsed = JSON.parse(JSON.stringify(eventToProcess.payload)) as Record<string, unknown>;
              // Map ticketId to ticket_id if needed
              payload = {
                ticket_id: typeof parsed.ticket_id === 'number' ? parsed.ticket_id :
                          typeof parsed.ticketId === 'number' ? parsed.ticketId : 0,
                created_by_clerk: typeof parsed.created_by_clerk === 'string' ? parsed.created_by_clerk : undefined,
                category: typeof parsed.category === 'string' ? parsed.category : undefined,
                ...parsed
              };
            } else {
              console.warn("[Ticket API] Invalid outbox payload type, using empty object:", typeof eventToProcess.payload);
              payload = { ticket_id: 0 };
            }
          } catch (error) {
            console.error("[Ticket API] Error processing outbox payload:", error);
            payload = { ticket_id: 0 };
          }
          
          // Process immediately (non-blocking)
          console.log(`[Ticket API] 🚀 Processing outbox event ${eventToProcess.id} for ticket #${payload.ticket_id} (email & Slack notifications)`);
          processTicketCreated(eventToProcess.id, payload)
            .then(() => {
              console.log(`[Ticket API] ✅ Successfully processed outbox event ${eventToProcess.id} - notifications sent`);
              return markOutboxSuccess(eventToProcess.id);
            })
            .catch((error) => {
              console.error(`[Ticket API] ❌ Failed to process outbox event ${eventToProcess.id}:`, error);
              console.error("[Ticket API] Error stack:", error instanceof Error ? error.stack : "No stack trace");
              return markOutboxFailure(eventToProcess.id, error instanceof Error ? error.message : "Unknown error");
            });
        } else {
          console.warn(`[Ticket API] ⚠️ Outbox event ${eventToProcess?.id || 'unknown'} has no payload for ticket #${ticket.id}`);
        }
      } catch (error) {
        // Log but don't fail the request if immediate processing fails
        const errorMessage = error instanceof Error 
          ? error.message 
          : typeof error === 'string' 
            ? error 
            : 'Unknown error';
        console.error(`[Ticket API] ❌ Error in async notification processing for ticket #${ticket.id}:`, errorMessage);
        if (error instanceof Error && error.stack) {
          console.error("[Ticket API] Error stack:", error.stack);
        }
        console.warn("[Ticket API] Cron job will process this event as backup");
      }
    })().catch((error) => {
      // Catch any unhandled errors in the async block
      console.error("[Ticket API] Unhandled error in async notification block:", error);
    });

    return NextResponse.json(ticket, { 
      status: 201,
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error("Ticket creation failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json(
      { error: errorMessage },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
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
        .where(eq(users.external_id, userId))
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
        .where(eq(users.external_id, userId))
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

