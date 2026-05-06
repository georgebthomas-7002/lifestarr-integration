"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db, integrations, needsReviewQueue } from "@/lib/db";
import { replayWebhook } from "@/lib/replay-webhook";

export async function toggleIntegrationStatus(eventType: string) {
  const rows = await db
    .select({ id: integrations.id, status: integrations.status })
    .from(integrations)
    .where(eq(integrations.eventType, eventType))
    .limit(1);

  const current = rows[0];
  if (!current) return { ok: false, error: "not_found" };
  if (current.status !== "live" && current.status !== "paused") {
    return { ok: false, error: "not_toggleable" };
  }

  const next = current.status === "live" ? "paused" : "live";
  await db
    .update(integrations)
    .set({ status: next, updatedAt: new Date() })
    .where(eq(integrations.id, current.id));

  revalidatePath("/dashboard");
  return { ok: true, status: next };
}

export async function retryWebhook(webhookEventId: string) {
  try {
    const outcome = await replayWebhook(webhookEventId);
    revalidatePath("/dashboard/activity");
    revalidatePath("/dashboard");
    return { ok: true, outcome };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function markReviewResolved(reviewId: string, resolvedBy: string, notes?: string) {
  await db
    .update(needsReviewQueue)
    .set({
      resolved: true,
      resolvedAt: new Date(),
      resolvedBy,
      notes: notes ?? null,
      updatedAt: new Date(),
    })
    .where(eq(needsReviewQueue.id, reviewId));
  revalidatePath("/dashboard/review");
  return { ok: true };
}
