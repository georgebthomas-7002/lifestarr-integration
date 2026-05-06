import { eq } from "drizzle-orm";

import { db, webhookEvents } from "@/lib/db";
import { applyOutcome } from "@/lib/process-outcome";
import { dispatch } from "@/lib/router";
import type { MightyWebhookPayload } from "@/lib/types";

export async function replayWebhook(webhookEventId: string) {
  const rows = await db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.id, webhookEventId))
    .limit(1);

  const row = rows[0];
  if (!row) throw new Error(`webhook_event ${webhookEventId} not found`);

  const payload: MightyWebhookPayload = {
    event_id: row.eventId,
    event_timestamp: row.receivedAt.toISOString(),
    event_type: row.eventType,
    payload: row.payload as Record<string, unknown>,
  };

  await db
    .update(webhookEvents)
    .set({
      status: "pending",
      retryCount: row.retryCount + 1,
      updatedAt: new Date(),
    })
    .where(eq(webhookEvents.id, row.id));

  try {
    const outcome = await dispatch(payload);
    await applyOutcome(row.id, row.eventType, outcome);
    return outcome;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await db
      .update(webhookEvents)
      .set({
        status: "failed",
        errorMessage,
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(webhookEvents.id, row.id));
    throw err;
  }
}
