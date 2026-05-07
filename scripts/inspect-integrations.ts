/**
 * Print current integrations table state — success/failure counts per
 * event type — so we can verify the dashboard's Status Grid against the DB.
 *
 *   npx tsx --env-file=.env.local scripts/inspect-integrations.ts
 */
import { db, integrations } from "@/lib/db";

async function main() {
  const rows = await db.select().from(integrations);
  console.log(`\n${rows.length} integration rows:\n`);
  console.log(
    `  ${"event_type".padEnd(30)} ${"status".padEnd(12)} ${"success".padStart(8)} ${"failure".padStart(8)}  last_fired`,
  );
  console.log(`  ${"─".repeat(80)}`);
  for (const r of [...rows].sort((a, b) => a.eventType.localeCompare(b.eventType))) {
    const lastFired = r.lastFiredAt ? r.lastFiredAt.toISOString().slice(0, 19) : "—";
    console.log(
      `  ${r.eventType.padEnd(30)} ${r.status.padEnd(12)} ${String(r.successCount).padStart(8)} ${String(r.failureCount).padStart(8)}  ${lastFired}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
