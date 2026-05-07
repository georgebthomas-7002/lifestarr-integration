import { Activity, AlertTriangle, Sparkles, TrendingUp, Users } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getDashboardStats } from "@/lib/dashboard-stats";

export async function StatsStrip() {
  const stats = await getDashboardStats();

  const cards: Array<{
    label: string;
    value: string;
    sub?: string;
    icon: typeof Users;
    accent: string;
  }> = [
    {
      label: "Members synced",
      value: stats.totalMembers !== null ? stats.totalMembers.toLocaleString() : "—",
      sub: "in HubSpot with mighty_member_id",
      icon: Users,
      accent: "text-brand-teal",
    },
    {
      label: "Premier",
      value: stats.premierMembers !== null ? stats.premierMembers.toLocaleString() : "—",
      sub:
        stats.premierPercent !== null
          ? `${stats.premierPercent}% of synced members`
          : "% unavailable",
      icon: TrendingUp,
      accent: "text-brand-orange",
    },
    {
      label: "Premier-ready",
      value: stats.premierReady !== null ? stats.premierReady.toLocaleString() : "—",
      sub: "engagement score ≥ 50",
      icon: Sparkles,
      accent: "text-brand-yellow",
    },
    {
      label: "Events (24h)",
      value: stats.events24h.toLocaleString(),
      sub: stats.errors24h > 0 ? `${stats.errors24h} failed` : "all healthy",
      icon: stats.errors24h > 0 ? AlertTriangle : Activity,
      accent: stats.errors24h > 0 ? "text-red-600" : "text-brand-pink",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.label} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {c.label}
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">{c.value}</div>
                {c.sub && (
                  <div className="mt-1 text-xs text-muted-foreground">{c.sub}</div>
                )}
              </div>
              <Icon className={`h-5 w-5 ${c.accent}`} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
