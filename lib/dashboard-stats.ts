import { gte } from "drizzle-orm";

import { db, webhookEvents } from "@/lib/db";

import { Client } from "@hubspot/api-client";
import { FilterOperatorEnum } from "@hubspot/api-client/lib/codegen/crm/contacts";
// We import the same client our handlers use. For the dashboard read-only
// stats we don't need retries — just raw counts. So a separate fresh client
// avoids holding the singleton's retry queue while we tally numbers.

export type DashboardStats = {
  totalMembers: number | null;
  premierMembers: number | null;
  premierPercent: number | null;
  premierReady: number | null;
  events24h: number;
  errors24h: number;
};

let _statsClient: Client | null = null;
function statsClient(): Client {
  if (_statsClient) return _statsClient;
  _statsClient = new Client({
    accessToken: process.env.HUBSPOT_API_TOKEN ?? "",
    numberOfApiCallRetries: 2,
  });
  return _statsClient;
}

async function countContactsByFilter(filters: Array<{ propertyName: string; operator: FilterOperatorEnum; value?: string; values?: string[] }>): Promise<number | null> {
  if (!process.env.HUBSPOT_API_TOKEN) return null;
  try {
    const res = await statsClient().crm.contacts.searchApi.doSearch({
      filterGroups: [{ filters: filters as never }],
      properties: ["email"],
      limit: 1,
      sorts: [],
      after: "0",
    });
    return res.total ?? 0;
  } catch (err) {
    console.error("[dashboard-stats] count failed:", err);
    return null;
  }
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Run independent queries in parallel
  const [total, premier, premierReady, eventsCount, errorsCount] = await Promise.all([
    countContactsByFilter([
      { propertyName: "mighty_member_id", operator: FilterOperatorEnum.HasProperty },
    ]),
    countContactsByFilter([
      {
        propertyName: "lifestarr_plan",
        operator: FilterOperatorEnum.In,
        values: ["premier_monthly", "premier_annual"],
      },
    ]),
    countContactsByFilter([
      { propertyName: "lifestarr_premier_ready", operator: FilterOperatorEnum.Eq, value: "true" },
    ]),
    db
      .select()
      .from(webhookEvents)
      .where(gte(webhookEvents.receivedAt, since))
      .then((rows) => rows.length),
    db
      .select()
      .from(webhookEvents)
      .where(gte(webhookEvents.receivedAt, since))
      .then((rows) => rows.filter((r) => r.status === "failed").length),
  ]);

  const premierPercent =
    total !== null && total > 0 && premier !== null
      ? Math.round((premier / total) * 100)
      : null;

  return {
    totalMembers: total,
    premierMembers: premier,
    premierPercent,
    premierReady,
    events24h: eventsCount,
    errors24h: errorsCount,
  };
}
