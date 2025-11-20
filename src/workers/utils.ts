import { db } from "@/db";
import { outbox } from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export type OutboxRow = InferSelectModel<typeof outbox>;

/**
 * Pick the next pending outbox row.
 * Uses a transaction to avoid delivering the same event twice when the cron endpoint
 * is hit concurrently.
 */
export async function claimNextOutboxRow(): Promise<OutboxRow | null> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(outbox)
      .where(
        sql`${outbox.processed_at} IS NULL AND (${outbox.next_retry_at} IS NULL OR ${outbox.next_retry_at} <= NOW())`
      )
      .orderBy(asc(outbox.id))
      .limit(1);

    if (!row) {
      return null;
    }

    await tx
      .update(outbox)
      .set({
        attempts: row.attempts + 1,
        next_retry_at: null,
      })
      .where(eq(outbox.id, row.id));

    return row;
  });
}

export async function markOutboxSuccess(outboxId: number, _metadata?: Record<string, any>) {
  await db
    .update(outbox)
    .set({
      processed_at: new Date(),
      next_retry_at: null,
    })
    .where(eq(outbox.id, outboxId));
}

export async function markOutboxFailure(outboxId: number, reason?: string) {
  const [row] = await db
    .select({ attempts: outbox.attempts })
    .from(outbox)
    .where(eq(outbox.id, outboxId))
    .limit(1);

  const attempts = row?.attempts ?? 0;
  const delayMinutes = Math.min(60, Math.pow(2, attempts));
  const nextRetry = new Date(Date.now() + delayMinutes * 60 * 1000);

  if (reason) {
    console.error(`[Outbox] Failed to process event ${outboxId}: ${reason}`);
  }

  await db
    .update(outbox)
    .set({
      next_retry_at: nextRetry,
    })
    .where(eq(outbox.id, outboxId));
}

