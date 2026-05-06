import { eq, sql } from "drizzle-orm";

import { db, integrations, webhookEvents } from "@/lib/db";
import type { WebhookEventStatus } from "@/lib/db";
import {
  ENGAGEMENT_BUNDLE_EVENT_TYPE,
  ENGAGEMENT_EVENT_TYPES,
} from "@/lib/integrations-config";
import type { DispatchOutcome } from "@/lib/router";

const ENGAGEMENT_SET = new Set<string>(ENGAGEMENT_EVENT_TYPES);

async function bumpIntegrationCounter(
  eventType: string,
  success: boolean,
) {
  await db
    .update(integrations)
    .set({
      successCount: success
        ? sql`${integrations.successCount} + 1`
        : integrations.successCount,
      failureCount: success
        ? integrations.failureCount
        : sql`${integrations.failureCount} + 1`,
      lastFiredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(integrations.eventType, eventType));
}

async function bumpIntegrationsForEvent(eventType: string, success: boolean) {
  await bumpIntegrationCounter(eventType, success);
  if (ENGAGEMENT_SET.has(eventType)) {
    await bumpIntegrationCounter(ENGAGEMENT_BUNDLE_EVENT_TYPE, success);
  }
}

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

  await bumpIntegrationsForEvent(eventType, result.success);
}
