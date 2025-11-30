import { db } from "@/db";
import { notifications, outbox } from "@/db/schema";
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
        attempts: (row.attempts || 0) + 1,
        next_retry_at: null,
      })
      .where(eq(outbox.id, row.id));

    return row;
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function markOutboxSuccess(outboxId: number, _metadata?: Record<string, unknown>) {
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

type LogNotificationParams = {
  userId?: string | null;
  ticketId?: number | null;
  channel: string;
  notificationType: string;
  slackMessageId?: string | null;
  emailMessageId?: string | null;
  sentAt?: Date;
};

export async function logNotification({
  userId,
  ticketId,
  channel,
  notificationType,
  slackMessageId,
  emailMessageId,
  sentAt,
}: LogNotificationParams): Promise<void> {
  try {
    await db.insert(notifications).values({
      user_id: userId ?? null,
      ticket_id: ticketId ?? null,
      channel,
      notification_type: notificationType,
      slack_message_id: slackMessageId ?? null,
      email_message_id: emailMessageId ?? null,
      sent_at: sentAt ?? new Date(),
    });
  } catch (error) {
    console.error("[logNotification] Failed to record notification", {
      error,
      channel,
      notificationType,
      userId,
      ticketId,
    });
  }
}

