/**
 * Read-only snapshot of failed / needs-review / retrying webhook events,
 * so we can pick out the ones that came from local test scripts vs. real
 * Mighty traffic before deleting anything.
 *
 *   npx tsx --env-file=.env.local scripts/inspect-failures.ts
 */
import { desc, inArray } from "drizzle-orm";

import { db, webhookEvents, type WebhookEventStatus } from "@/lib/db";

const TEST_STATUSES: WebhookEventStatus[] = ["failed", "needs_review", "retrying"];

function categorize(eventId: string, payload: unknown): string {
  if (eventId.startsWith("test-")) return "TEST_SCRIPT";
  if (eventId.startsWith("bad-auth-")) return "BAD_AUTH_SCRIPT";

  const p = payload as Record<string, unknown> | null;
  const email =
    (p?.email as string | undefined) ??
    ((p?.member as Record<string, unknown> | undefined)?.email as string | undefined) ??
    (p?.member_email as string | undefined);

  if (email?.includes("lifestarr-test+")) return "TEST_EMAIL";
  if (email?.endsWith("@sidekickstrategies.com")) return "SIDEKICK_INTERNAL";
  return "REAL";
}

async function main() {
  const rows = await db
    .select()
    .from(webhookEvents)
    .where(inArray(webhookEvents.status, TEST_STATUSES))
    .orderBy(desc(webhookEvents.receivedAt));

  console.log(`\n${rows.length} failing events total\n`);

  const buckets: Record<string, typeof rows> = {};
  for (const r of rows) {
    const cat = categorize(r.eventId, r.payload);
    (buckets[cat] ??= []).push(r);
  }

  for (const [cat, items] of Object.entries(buckets).sort()) {
    console.log(`── ${cat}: ${items.length}`);
    for (const r of items) {
      const p = r.payload as Record<string, unknown> | null;
      const email =
        (p?.email as string | undefined) ??
        ((p?.member as Record<string, unknown> | undefined)?.email as string | undefined) ??
        (p?.member_email as string | undefined) ??
        "—";
      const err = (r.errorMessage ?? "").slice(0, 60);
      console.log(
        `   ${r.receivedAt.toISOString().slice(0, 19)} ${r.status.padEnd(13)} ${r.eventType.padEnd(26)} ${email.padEnd(38)} ${err}`,
      );
    }
    console.log();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
