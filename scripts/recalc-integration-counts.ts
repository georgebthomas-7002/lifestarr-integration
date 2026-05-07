/**
 * Rebuild integrations.success_count and failure_count from the current
 * webhook_events table. Treats:
 *   - status = 'success'                           → success
 *   - status in (failed | needs_review | retrying) → failure
 *   - status = 'no_handler_registered' / 'pending' → ignored (matches the
 *     applyOutcome logic in lib/process-outcome.ts which doesn't bump
 *     either counter for those states)
 *
 * The engagement_bundle row aggregates the 6 engagement event types.
 *
 *   npx tsx --env-file=.env.local scripts/recalc-integration-counts.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/recalc-integration-counts.ts --apply  # write
 */
import { eq, sql } from "drizzle-orm";

import { db, integrations, webhookEvents } from "@/lib/db";
import {
  ENGAGEMENT_BUNDLE_EVENT_TYPE,
  ENGAGEMENT_EVENT_TYPES,
} from "@/lib/integrations-config";

const ENGAGEMENT_SET = new Set<string>(ENGAGEMENT_EVENT_TYPES);

async function main() {
  const apply = process.argv.includes("--apply");

  // Aggregate per event_type from webhook_events
  const stats = await db
    .select({
      eventType: webhookEvents.eventType,
      successCount: sql<number>`SUM(CASE WHEN ${webhookEvents.status} = 'success' THEN 1 ELSE 0 END)::int`,
      failureCount: sql<number>`SUM(CASE WHEN ${webhookEvents.status} IN ('failed', 'needs_review', 'retrying') THEN 1 ELSE 0 END)::int`,
    })
    .from(webhookEvents)
    .groupBy(webhookEvents.eventType);

  // Build a map keyed by eventType
  const recalc = new Map<string, { success: number; failure: number }>();
  for (const r of stats) {
    recalc.set(r.eventType, { success: r.successCount, failure: r.failureCount });
  }

  // Engagement bundle: sum across the 6 engagement event types
  let engSuccess = 0;
  let engFailure = 0;
  for (const t of ENGAGEMENT_EVENT_TYPES) {
    const v = recalc.get(t);
    if (!v) continue;
    engSuccess += v.success;
    engFailure += v.failure;
  }
  recalc.set(ENGAGEMENT_BUNDLE_EVENT_TYPE, { success: engSuccess, failure: engFailure });

  // Read current integrations rows so we can show before/after
  const current = await db.select().from(integrations);

  console.log(
    `\n${apply ? "RECALCULATING" : "DRY RUN — would update"} integration counts:\n`,
  );
  console.log(
    `  ${"event_type".padEnd(28)} ${"success (was → new)".padEnd(22)} ${"failure (was → new)".padEnd(22)}`,
  );
  console.log(`  ${"─".repeat(78)}`);

  for (const row of [...current].sort((a, b) => a.eventType.localeCompare(b.eventType))) {
    // Engagement event types don't have their own integration card — they only
    // show up via engagement_bundle, so skip them in the per-row recompute.
    const isEngagementSubtype = ENGAGEMENT_SET.has(row.eventType);
    const target = recalc.get(row.eventType) ?? { success: 0, failure: 0 };
    const newSuccess = isEngagementSubtype ? row.successCount : target.success;
    const newFailure = isEngagementSubtype ? row.failureCount : target.failure;

    const sucStr = `${row.successCount} → ${newSuccess}`;
    const failStr = `${row.failureCount} → ${newFailure}`;
    console.log(
      `  ${row.eventType.padEnd(28)} ${sucStr.padEnd(22)} ${failStr.padEnd(22)}`,
    );

    if (apply && !isEngagementSubtype) {
      await db
        .update(integrations)
        .set({
          successCount: newSuccess,
          failureCount: newFailure,
          updatedAt: new Date(),
        })
        .where(eq(integrations.id, row.id));
    }
  }

  if (!apply) {
    console.log("\nRe-run with --apply to write.");
  } else {
    console.log("\nDone.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
