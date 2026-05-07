import { eq, sql } from "drizzle-orm";
import { after, NextResponse } from "next/server";

import { sendFailureAlert } from "@/lib/alert";
import { db, integrations, webhookEvents } from "@/lib/db";
import {
  ENGAGEMENT_BUNDLE_EVENT_TYPE,
  ENGAGEMENT_EVENT_TYPES,
} from "@/lib/integrations-config";
import { applyOutcome } from "@/lib/process-outcome";
import { dispatch } from "@/lib/router";
import type { MightyWebhookPayload } from "@/lib/types";
import { verifyMightyWebhook } from "@/lib/verify-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!verifyMightyWebhook(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: MightyWebhookPayload;
  try {
    body = (await req.json()) as MightyWebhookPayload;
  } catch {
    return NextResponse.json({ error: "malformed_body" }, { status: 400 });
  }

  if (
    typeof body.event_id !== "string" ||
    typeof body.event_type !== "string" ||
    typeof body.payload !== "object" ||
    body.payload === null
  ) {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.eventId, body.event_id))
    .limit(1);

  if (existing[0]?.status === "success" || existing[0]?.status === "no_handler_registered") {
    return NextResponse.json({
      status: "already_processed",
      id: existing[0].id,
      previous_status: existing[0].status,
    });
  }

  const row = existing[0]
    ? (
        await db
          .update(webhookEvents)
          .set({ status: "pending", updatedAt: new Date() })
          .where(eq(webhookEvents.id, existing[0].id))
          .returning()
      )[0]
    : (
        await db
          .insert(webhookEvents)
          .values({
            eventId: body.event_id,
            eventType: body.event_type,
            payload: body.payload,
          })
          .returning()
      )[0];

  try {
    const outcome = await dispatch(body);
    await applyOutcome(row.id, body.event_type, outcome);
    return NextResponse.json({ status: "ok", id: row.id, outcome });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const newRetryCount = (row.retryCount ?? 0) + 1;
    await db
      .update(webhookEvents)
      .set({
        status: "failed",
        errorMessage,
        retryCount: newRetryCount,
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(webhookEvents.id, row.id));
    after(async () => {
      await sendFailureAlert({
        webhookEventId: row.id,
        eventType: body.event_type,
        errorMessage,
        retryCount: newRetryCount,
      });
    });
    if (ENGAGEMENT_EVENT_TYPES.includes(body.event_type as (typeof ENGAGEMENT_EVENT_TYPES)[number])) {
      await db
        .update(integrations)
        .set({
          failureCount: sql`${integrations.failureCount} + 1`,
          lastFiredAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(integrations.eventType, ENGAGEMENT_BUNDLE_EVENT_TYPE));
    }
    await db
      .update(integrations)
      .set({
        failureCount: sql`${integrations.failureCount} + 1`,
        lastFiredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(integrations.eventType, body.event_type));
    return NextResponse.json(
      { status: "failed", id: row.id, error: errorMessage },
      { status: 500 },
    );
  }
}
