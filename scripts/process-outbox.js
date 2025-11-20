
import { db, outbox } from "../src/db";
import { eq, lt, and, or, isNull } from "drizzle-orm";
import { processTicketCreatedWorker } from "../src/workers/handlers/processTicketCreatedWorker";
import { processTicketCommentAddedWorker } from "../src/workers/handlers/processTicketCommentAddedWorker";
import { processTicketStatusChangedWorker } from "../src/workers/handlers/processTicketStatusChangedWorker";
import { processTicketEscalatedWorker } from "../src/workers/handlers/processTicketEscalatedWorker";

const BATCH_SIZE = 10;
const POLL_INTERVAL = 5000; // 5 seconds

async function processOutbox() {
    console.log("Starting outbox processor...");

    while (true) {
        try {
            // Fetch pending events
            const events = await db
                .select()
                .from(outbox)
                .where(
                    and(
                        lt(outbox.attempts, 3), // Max 3 attempts
                        or(
                            isNull(outbox.next_retry_at),
                            lt(outbox.next_retry_at, new Date())
                        ),
                        isNull(outbox.processed_at)
                    )
                )
                .limit(BATCH_SIZE);

            if (events.length === 0) {
                // No events, wait and retry
                await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
                continue;
            }

            console.log(`Processing ${events.length} events...`);

            for (const event of events) {
                try {
                    console.log(`Processing event ${event.id} (${event.event_type})`);

                    // Dispatch to appropriate worker
                    switch (event.event_type) {
                        case "ticket.created":
                            await processTicketCreatedWorker(event.payload);
                            break;
                        case "ticket.comment_added":
                            await processTicketCommentAddedWorker(event.payload);
                            break;
                        case "ticket.status_changed":
                            await processTicketStatusChangedWorker(event.payload);
                            break;
                        case "ticket.escalated":
                            await processTicketEscalatedWorker(event.payload);
                            break;
                        default:
                            console.warn(`Unknown event type: ${event.event_type}`);
                    }

                    // Mark as processed
                    await db
                        .update(outbox)
                        .set({
                            processed_at: new Date(),
                        })
                        .where(eq(outbox.id, event.id));

                    console.log(`Event ${event.id} processed successfully`);

                } catch (error) {
                    console.error(`Failed to process event ${event.id}:`, error);

                    // Increment attempts and schedule retry
                    const nextRetry = new Date();
                    nextRetry.setMinutes(nextRetry.getMinutes() + Math.pow(2, event.attempts + 1)); // Exponential backoff

                    await db
                        .update(outbox)
                        .set({
                            attempts: event.attempts + 1,
                            next_retry_at: nextRetry,
                        })
                        .where(eq(outbox.id, event.id));
                }
            }

        } catch (error) {
            console.error("Error in outbox processor loop:", error);
            await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
        }
    }
}

// Start processing
processOutbox().catch(console.error);
