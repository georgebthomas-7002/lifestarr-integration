import { eq, sql } from "drizzle-orm";

import { db, integrations, webhookEvents } from "@/lib/db";
import type { WebhookEventStatus } from "@/lib/db";
import type { DispatchOutcome } from "@/lib/router";

export async function applyOutcome(
  rowId: string,
  eventType: string,
  outcome: DispatchOutcome,
) {
  if (outcome.kind === "no_handler") {
    await db
      .update(webhookEvents)
      .set({
        status: "no_handler_registered" satisfies WebhookEventStatus,
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(webhookEvents.id, rowId));
    return;
  }

  const { result, handlerName } = outcome;
  const status: WebhookEventStatus = result.needsReview
    ? "needs_review"
    : result.success
      ? "success"
      : "failed";

  await db
    .update(webhookEvents)
    .set({
      status,
      processedAt: new Date(),
      handlerName,
      errorMessage: result.success ? null : (result.message ?? "handler_returned_failure"),
      updatedAt: new Date(),
    })
    .where(eq(webhookEvents.id, rowId));

  await db
    .update(integrations)
    .set({
      successCount: result.success
        ? sql`${integrations.successCount} + 1`
        : integrations.successCount,
      failureCount: result.success
        ? integrations.failureCount
        : sql`${integrations.failureCount} + 1`,
      lastFiredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(integrations.eventType, eventType));
}
