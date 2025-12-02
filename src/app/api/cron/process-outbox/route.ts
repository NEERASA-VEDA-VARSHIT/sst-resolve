import { NextRequest, NextResponse } from "next/server";
import { claimNextOutboxRow, markOutboxSuccess, markOutboxFailure } from "@/workers/utils";
import { processTicketCreated } from "@/workers/handlers/processTicketCreatedWorker";
import { verifyCronAuth } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { db, outbox } from "@/db";
import { sql } from "drizzle-orm";

type TicketCreatedPayload = {
  ticket_id: number;
  created_by_clerk?: string;
  category?: string;
};

/**
 * Cron endpoint to process outbox events
 * Should be called periodically (e.g., every minute) to process pending notifications
 * 
 * Security: Protected with CRON_SECRET (mandatory in production)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron authentication (mandatory in production)
    const authError = verifyCronAuth(request);
    if (authError) {
      return authError;
    }

    const maxEventsPerRun = 10; // Process up to 10 events per cron run
    let processed = 0;
    let errors = 0;

    while (processed < maxEventsPerRun) {
      const outboxRow = await claimNextOutboxRow();

      if (!outboxRow) {
        // No more events to process
        break;
      }

      try {
        const { event_type, payload, id } = outboxRow;

        // Route to appropriate handler based on event type
        switch (event_type) {
          case "ticket.created":
          case "ticket.created.v1":
            // Safety check: ensure payload is a valid object before processing
            let ticketPayload: TicketCreatedPayload;
            try {
              if (payload && typeof payload === 'object' && !Array.isArray(payload) && payload !== null) {
                // Deep clone to avoid any reference issues
                const parsed = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
                // Ensure ticket_id exists
                if (typeof parsed.ticket_id === 'number') {
                  ticketPayload = {
                    ticket_id: parsed.ticket_id,
                    created_by_clerk: typeof parsed.created_by_clerk === 'string' ? parsed.created_by_clerk : undefined,
                    category: typeof parsed.category === 'string' ? parsed.category : undefined,
                  };
                } else {
                  logger.warn(`[Outbox] Missing ticket_id in payload for event ${id}`);
                  throw new Error('Invalid payload: missing ticket_id');
                }
              } else {
                logger.warn(`[Outbox] Invalid payload type for event ${id}`, { payloadType: typeof payload });
                throw new Error('Invalid payload type');
              }
            } catch (error) {
              logger.error(`[Outbox] Error processing payload for event ${id}`, error);
              // Skip this event if payload is invalid
              await markOutboxFailure(id, error instanceof Error ? error.message : 'Invalid payload');
              errors++;
              continue;
            }
            await processTicketCreated(id, ticketPayload);
            await markOutboxSuccess(id);
            processed++;
            break;

          // Add other event types here as needed
          // case "ticket.status.updated":
          //   await processTicketStatusUpdated(id, payload);
          //   await markOutboxSuccess(id);
          //   break;

          default:
            logger.warn(`[Outbox] Unknown event type: ${event_type}`);
            await markOutboxFailure(id, `Unknown event type: ${event_type}`);
            errors++;
            break;
        }
      } catch (error) {
        logger.error(`[Outbox] Error processing event ${outboxRow.id}`, error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        await markOutboxFailure(outboxRow.id, errorMessage);
        errors++;
      }
    }

    // Log warning if there are many unprocessed events (potential backlog)
    const unprocessedCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(outbox)
      .where(sql`${outbox.processed_at} IS NULL`)
      .then(([row]) => row?.count || 0);
    
    if (unprocessedCount > 50) {
      console.warn(`[Outbox] High backlog detected: ${unprocessedCount} unprocessed events`);
    }

    return NextResponse.json({
      success: true,
      processed,
      errors,
      unprocessed: unprocessedCount,
      message: `Processed ${processed} events${errors > 0 ? `, ${errors} errors` : ""}`,
    });
  } catch (error) {
    logger.error("[Outbox Cron] Fatal error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering
export const POST = GET;

