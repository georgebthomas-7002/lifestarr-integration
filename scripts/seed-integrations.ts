import { config } from "dotenv";

config({ path: ".env.local" });

import { eq } from "drizzle-orm";

import { db, integrations } from "@/lib/db";
import { INTEGRATION_CARDS } from "@/lib/integrations-config";

async function main() {
  for (const card of INTEGRATION_CARDS) {
    const existing = await db
      .select({ id: integrations.id })
      .from(integrations)
      .where(eq(integrations.eventType, card.eventType))
      .limit(1);

    if (existing[0]) {
      await db
        .update(integrations)
        .set({
          name: card.name,
          description: card.description,
          updatedAt: new Date(),
        })
        .where(eq(integrations.id, existing[0].id));
      console.log(`✓ ${card.eventType.padEnd(32)} updated`);
    } else {
      await db.insert(integrations).values({
        eventType: card.eventType,
        name: card.name,
        description: card.description,
        status: card.defaultStatus,
      });
      console.log(`+ ${card.eventType.padEnd(32)} created`);
    }
  }
  console.log(`\n✅ ${INTEGRATION_CARDS.length} integration cards seeded`);
}

main().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});
