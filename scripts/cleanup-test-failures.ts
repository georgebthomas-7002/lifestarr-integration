/**
 * Delete failed / needs_review / retrying webhook events that originated
 * from test accounts (george+*@georgebthomas.com, *+george@georgebthomas.com),
 * and decrement the matching integrations.failure_count rows so the Status
 * Grid stops showing inflated failure totals.
 *
 *   npx tsx --env-file=.env.local scripts/cleanup-test-failures.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/cleanup-test-failures.ts --apply  # delete
 */
import { eq, inArray, sql } from "drizzle-orm";

import { db, integrations, webhookEvents, type WebhookEventStatus } from "@/lib/db";
import { ENGAGEMENT_BUNDLE_EVENT_TYPE, ENGAGEMENT_EVENT_TYPES } from "@/lib/integrations-config";

const FAILING_STATUSES: WebhookEventStatus[] = ["failed", "needs_review", "retrying"];
const ENGAGEMENT_SET = new Set<string>(ENGAGEMENT_EVENT_TYPES);

function extractEmail(payload: unknown): string | null {
  const p = payload as Record<string, unknown> | null;
  if (!p) return null;
  return (
    (p.email as string | undefined) ??
    ((p.member as Record<string, unknown> | undefined)?.email as string | undefined) ??
    (p.member_email as string | undefined) ??
    null
  );
}

function isTestEmail(email: string | null): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  if (!lower.endsWith("@georgebthomas.com")) return false;
  // Anything george+something@... or testN+george@...
  return /(^george\+|\+george@)/i.test(lower);
}

async function main() {
  const apply = process.argv.includes("--apply");

  const all = await db
    .select()
    .from(webhookEvents)
    .where(inArray(webhookEvents.status, FAILING_STATUSES));

  const targets = all.filter((r) => isTestEmail(extractEmail(r.payload)));

  if (targets.length === 0) {
    console.log("No test-account failures found. Nothing to do.");
    return;
  }

  // Tally per event_type so we can decrement integrations.failure_count
  const perType = new Map<string, number>();
  for (const r of targets) {
    perType.set(r.eventType, (perType.get(r.eventType) ?? 0) + 1);
  }

  console.log(`\n${apply ? "DELETING" : "DRY RUN — would delete"} ${targets.length} events:\n`);
  for (const [type, count] of [...perType.entries()].sort()) {
    console.log(`  ${type.padEnd(28)} ${count}`);
  }

  // Engagement-bundle counter gets bumped for any of the 6 engagement events
  let engagementBundleDelta = 0;
  for (const [type, count] of perType.entries()) {
    if (ENGAGEMENT_SET.has(type)) engagementBundleDelta += count;
  }
  if (engagementBundleDelta > 0) {
    console.log(`  ${ENGAGEMENT_BUNDLE_EVENT_TYPE.padEnd(28)} ${engagementBundleDelta}`);
  }

  if (!apply) {
    console.log("\nRe-run with --apply to actually delete.");
    return;
  }

  // 1. Delete the webhook_events rows. needs_review_queue.webhook_event_id has
  //    onDelete: set null, so we don't need to touch that table first — its
  //    rows just lose the FK pointer. We could prune them too if desired.
  const ids = targets.map((r) => r.id);
  await db.delete(webhookEvents).where(inArray(webhookEvents.id, ids));

  // 2. Decrement failure_count by the per-type tally. GREATEST() guards
  //    against ever going negative if something is out of sync.
  for (const [type, count] of perType.entries()) {
    await db
      .update(integrations)
      .set({
        failureCount: sql`GREATEST(${integrations.failureCount} - ${count}, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(integrations.eventType, type));
  }

  if (engagementBundleDelta > 0) {
    await db
      .update(integrations)
      .set({
        failureCount: sql`GREATEST(${integrations.failureCount} - ${engagementBundleDelta}, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(integrations.eventType, ENGAGEMENT_BUNDLE_EVENT_TYPE));
  }

  console.log(`\nDone. Deleted ${targets.length} rows and decremented integration counters.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
