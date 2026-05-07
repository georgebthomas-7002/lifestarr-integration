import { db, integrations } from "@/lib/db";
import { INTEGRATION_CARDS } from "@/lib/integrations-config";
import { relativeTime } from "@/lib/format-time";

import { StatusToggle } from "./status-toggle";
import { IntegrationStatusBadge } from "@/components/status-badge";
import { StatsStrip } from "@/components/stats-strip";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ACCENT_ROTATION = [
  "bg-brand-teal",
  "bg-brand-orange",
  "bg-brand-yellow",
  "bg-brand-pink",
] as const;

export default async function StatusGridPage() {
  const rows = await db.select().from(integrations);
  const byEventType = new Map(rows.map((r) => [r.eventType, r]));

  return (
    <div className="space-y-8">
      <StatsStrip />
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Integration Status</h2>
        <p className="text-sm text-muted-foreground">
          {INTEGRATION_CARDS.length} integrations configured · live count reflects current state in
          the database.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {INTEGRATION_CARDS.map((card, idx) => {
          const row = byEventType.get(card.eventType);
          const status = (row?.status ?? card.defaultStatus) as
            | "live"
            | "paused"
            | "building"
            | "not_started";
          const successCount = row?.successCount ?? 0;
          const failureCount = row?.failureCount ?? 0;
          const lastFiredAt = row?.lastFiredAt ?? null;
          const accent = ACCENT_ROTATION[idx % ACCENT_ROTATION.length];

          return (
            <Card key={card.eventType} className="flex flex-col overflow-hidden p-0">
              <div className={`h-1 ${accent}`} />
              <CardHeader className="pt-6">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">{card.name}</CardTitle>
                  <IntegrationStatusBadge status={status} />
                </div>
                <CardDescription className="leading-relaxed">{card.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto space-y-3 pb-6">
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <Stat label="Success" value={successCount.toString()} tone="positive" />
                  <Stat label="Failures" value={failureCount.toString()} tone={failureCount > 0 ? "negative" : "neutral"} />
                  <Stat label="Last fired" value={lastFiredAt ? relativeTime(lastFiredAt) : "Never"} tone="neutral" />
                </div>
                {(status === "live" || status === "paused") && (
                  <StatusToggle eventType={card.eventType} status={status} />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-red-600 dark:text-red-400"
        : "text-foreground";
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className={`mt-1 text-sm font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
