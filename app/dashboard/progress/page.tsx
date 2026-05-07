import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PROGRESS_YESES, type ProgressStatus } from "@/lib/progress-data";

const STATUS_LABEL: Record<ProgressStatus, string> = {
  done: "Done",
  in_progress: "In progress",
  planned: "Planned",
  deferred: "Deferred",
};

const STATUS_COLOR: Record<ProgressStatus, string> = {
  done: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  in_progress: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
  planned: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 border-zinc-500/30",
  deferred: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
};

export default function ProgressPage() {
  const totals = {
    done: PROGRESS_YESES.filter((p) => p.status === "done").length,
    inProgress: PROGRESS_YESES.filter((p) => p.status === "in_progress").length,
    planned: PROGRESS_YESES.filter((p) => p.status === "planned").length,
    deferred: PROGRESS_YESES.filter((p) => p.status === "deferred").length,
  };

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Build Progress</h2>
        <p className="text-sm text-muted-foreground">
          The 7 yeses. {totals.done} done · {totals.inProgress} in progress · {totals.planned}{" "}
          planned · {totals.deferred} deferred.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {PROGRESS_YESES.map((yes) => {
          const total = yes.items.length;
          const completed = yes.items.filter((i) => i.done).length;
          const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
          return (
            <Card key={yes.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base leading-tight">
                      <span className="mr-2 text-muted-foreground">#{yes.number}</span>
                      {yes.name}
                    </CardTitle>
                  </div>
                  <Badge variant="outline" className={STATUS_COLOR[yes.status]}>
                    {STATUS_LABEL[yes.status]}
                  </Badge>
                </div>
                <CardDescription>{yes.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {completed} / {total} components
                    </span>
                    <span className="font-medium text-foreground">{pct}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <ul className="space-y-1">
                  {yes.items.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                          item.done
                            ? "border-emerald-500 bg-emerald-500/20"
                            : "border-muted-foreground/30 bg-transparent"
                        }`}
                      >
                        {item.done && <Check className="h-2.5 w-2.5 text-emerald-600" />}
                      </span>
                      <span className={item.done ? "text-foreground" : "text-muted-foreground"}>
                        {item.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
