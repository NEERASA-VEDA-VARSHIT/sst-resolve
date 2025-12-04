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
        
        
        // Find the outbox event for this specific ticket using JSONB query
        // Only look for unprocessed events
        console.log(`[Ticket API] 🔍 Searching for outbox event for ticket #${ticket.id}`);
        let outboxEvent;
        try {
          const results = await dbInstance
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
          outboxEvent = results[0];
          console.log(`[Ticket API] 🔍 Query completed. Found ${results.length} outbox event(s) for ticket #${ticket.id}`);
        } catch (queryError) {
          console.error(`[Ticket API] ❌ Error querying outbox for ticket #${ticket.id}:`, queryError);
          throw queryError;
        }
        
        let eventToProcess = outboxEvent;
        
        if (!outboxEvent) {
          console.log(`[Ticket API] ⏳ Outbox event not found immediately for ticket #${ticket.id}, retrying...`);
          // No outbox event found, retrying...
          // Wait a bit and retry once (race condition handling)
          await new Promise(resolve => setTimeout(resolve, 500));
          let retryEvent;
          try {
            const retryResults = await dbInstance
              .select()
              .from(outboxTable)
              .where(
                and(
                  eq(outboxTable.event_type, "ticket.created"),
                  isNull(outboxTable.processed_at),
                  sql`CAST(${outboxTable.payload}->>'ticket_id' AS INTEGER) = ${ticket.id}`
                )
              )
              .orderBy(desc(outboxTable.created_at))
              .limit(1);
            retryEvent = retryResults[0];
            console.log(`[Ticket API] 🔍 Retry query completed. Found ${retryResults.length} outbox event(s) for ticket #${ticket.id}`);
          } catch (retryError) {
            console.error(`[Ticket API] ❌ Error in retry query for ticket #${ticket.id}:`, retryError);
            // Try fallback for retry too
            try {
              const allUnprocessed = await dbInstance
                .select()
                .from(outboxTable)
                .where(
                  and(
                    eq(outboxTable.event_type, "ticket.created"),
                    isNull(outboxTable.processed_at)
                  )
                )
                .orderBy(desc(outboxTable.created_at))
                .limit(50);
              
              retryEvent = allUnprocessed.find(event => {
                if (!event.payload || typeof event.payload !== 'object') return false;
                const payload = event.payload as Record<string, unknown>;
                const eventTicketId = typeof payload.ticket_id === 'number' ? payload.ticket_id : 
                                     typeof payload.ticketId === 'number' ? payload.ticketId : null;
                return eventTicketId === ticket.id;
              });
              
              if (retryEvent) {
                console.log(`[Ticket API] ✅ Found outbox event ${retryEvent.id} using fallback retry query for ticket #${ticket.id}`);
              }
            } catch (fallbackRetryError) {
              console.error(`[Ticket API] ❌ Fallback retry query also failed for ticket #${ticket.id}:`, fallbackRetryError);
            }
          }
          
          if (!retryEvent) {
            // Still no outbox event after retry, cron job will handle it
            console.warn(`[Ticket API] ⚠️ Outbox event not found after retry for ticket #${ticket.id}. Cron job will process it.`);
            return;
          }
          console.log(`[Ticket API] ✅ Found outbox event ${retryEvent.id} on retry for ticket #${ticket.id}`);
          outboxEvent = retryEvent;
        } else {
          console.log(`[Ticket API] ✅ Found outbox event ${outboxEvent.id} for ticket #${ticket.id}`);
        }
        
        const eventToProcess = outboxEvent;
        
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
              console.log(`[Ticket API] 📦 Processing outbox event ${eventToProcess.id} for ticket #${payload.ticket_id} (category: ${payload.category || 'unknown'})`);
            } else {
              console.warn(`[Ticket API] ⚠️ Invalid outbox payload type for ticket #${ticket.id}, using empty object`);
              payload = { ticket_id: 0 };
            }
          } catch (error) {
            console.error(`[Ticket API] ❌ Error processing outbox payload for ticket #${ticket.id}:`, error);
            payload = { ticket_id: 0 };
          }
          
          if (payload.ticket_id === 0) {
            console.error(`[Ticket API] ❌ Invalid payload for ticket #${ticket.id}, skipping notification processing`);
            return;
          }
          
          // Process immediately (non-blocking)
          // Use void to explicitly mark as fire-and-forget, but ensure promise chain continues
          console.log(`[Ticket API] 🚀 Starting notification processing for ticket #${payload.ticket_id}`);
          void processTicketCreated(eventToProcess.id, payload)
            .then(() => {
              console.log(`[Ticket API] ✅ Notification processing completed for ticket #${payload.ticket_id}`);
              return markOutboxSuccess(eventToProcess.id);
            })
            .then(() => {
              console.log(`[Ticket API] ✅ Outbox event ${eventToProcess.id} marked as processed for ticket #${payload.ticket_id}`);
            })
            .catch((error) => {
              console.error(`[Ticket API] ❌ Failed to process outbox event ${eventToProcess.id} for ticket #${payload.ticket_id}:`, error);
              console.error("[Ticket API] Error stack:", error instanceof Error ? error.stack : "No stack trace");
              return markOutboxFailure(eventToProcess.id, error instanceof Error ? error.message : "Unknown error")
                .catch((markError) => {
                  console.error(`[Ticket API] ❌ Failed to mark outbox failure for event ${eventToProcess.id}:`, markError);
                });
            });
        } else {
          console.warn(`[Ticket API] ⚠️ Outbox event has no payload for ticket #${ticket.id}`);
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
        // Cron job will process this event as backup
      }
    })().catch((error) => {
      // Catch any unhandled errors in the async block
      console.error(`[Ticket API] ❌ Unhandled error in async notification block for ticket #${ticket.id}:`, error);
    });

    // Return minimal ticket data for faster response
    // Full ticket details can be fetched from /api/tickets/[id] if needed
    return NextResponse.json({ 
      id: ticket.id,
      ticket: {
        id: ticket.id,
        status_id: ticket.status_id,
        category_id: ticket.category_id,
        created_at: ticket.created_at,
      }
    }, { 
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

