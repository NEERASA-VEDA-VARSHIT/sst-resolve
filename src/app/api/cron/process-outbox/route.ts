import { NextRequest, NextResponse } from "next/server";
import { claimNextOutboxRow, markOutboxSuccess, markOutboxFailure } from "@/workers/utils";
import { processTicketCreated } from "@/workers/handlers/processTicketCreatedWorker";

/**
 * Cron endpoint to process outbox events
 * Should be called periodically (e.g., every minute) to process pending notifications
 * 
 * Security: Should be protected with a secret token or Vercel Cron configuration
 */
export async function GET(request: NextRequest) {
  try {
    // Optional: Verify cron secret for security
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // If CRON_SECRET is set, require it
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
            let ticketPayload: any = {};
            try {
              if (payload && typeof payload === 'object' && !Array.isArray(payload) && payload !== null) {
                // Deep clone to avoid any reference issues
                ticketPayload = JSON.parse(JSON.stringify(payload));
              } else {
                console.warn(`[Outbox] Invalid payload type for event ${id}, using empty object:`, typeof payload);
                ticketPayload = {};
              }
            } catch (error) {
              console.error(`[Outbox] Error processing payload for event ${id}:`, error);
              ticketPayload = {};
            }
            await processTicketCreated(id, ticketPayload as any);
            await markOutboxSuccess(id);
            processed++;
            break;

          // Add other event types here as needed
          // case "ticket.status.updated":
          //   await processTicketStatusUpdated(id, payload);
          //   await markOutboxSuccess(id);
          //   break;

          default:
            console.warn(`[Outbox] Unknown event type: ${event_type}`);
            await markOutboxFailure(id, `Unknown event type: ${event_type}`);
            errors++;
            break;
        }
      } catch (error: any) {
        console.error(`[Outbox] Error processing event ${outboxRow.id}:`, error);
        await markOutboxFailure(outboxRow.id, error?.message || "Unknown error");
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      errors,
      message: `Processed ${processed} events${errors > 0 ? `, ${errors} errors` : ""}`,
    });
  } catch (error: any) {
    console.error("[Outbox Cron] Fatal error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error?.message },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering
export const POST = GET;

