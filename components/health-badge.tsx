import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { getHealthStatus } from "@/lib/health";

export async function HealthBadge() {
  const report = await getHealthStatus();

  const config = {
    healthy: {
      Icon: CheckCircle2,
      className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      label: "Healthy",
    },
    degraded: {
      Icon: AlertCircle,
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
      label: "Degraded",
    },
    unhealthy: {
      Icon: XCircle,
      className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
      label: "Unhealthy",
    },
  } as const;

  const c = config[report.status];
  const failingChecks = Object.entries(report.checks)
    .filter(([, v]) => v !== "ok")
    .map(([k]) => k);

  const tooltip =
    failingChecks.length > 0
      ? `Failing: ${failingChecks.join(", ")}`
      : `All ${Object.keys(report.checks).length} checks ok · ${report.commit}`;

  return (
    <Badge
      variant="outline"
      className={`${c.className} gap-1.5 px-2 py-0.5 font-normal`}
      title={tooltip}
    >
      <c.Icon className="h-3 w-3" />
      <span className="text-[11px]">{c.label}</span>
    </Badge>
  );
}
