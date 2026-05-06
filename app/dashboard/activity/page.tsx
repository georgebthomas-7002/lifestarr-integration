import { desc, eq, type SQL } from "drizzle-orm";

import { RetryButton } from "./retry-button";
import { ActivityFilters } from "./filters";
import { WebhookStatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db, webhookEvents } from "@/lib/db";
import { relativeTime } from "@/lib/format-time";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const RETRYABLE_STATUSES = new Set(["failed", "needs_review", "retrying"]);

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ event_type?: string; status?: string }>;
}) {
  const params = await searchParams;

  const filters: SQL[] = [];
  if (params.event_type && params.event_type !== "all") {
    filters.push(eq(webhookEvents.eventType, params.event_type));
  }
  if (params.status && params.status !== "all") {
    filters.push(eq(webhookEvents.status, params.status as never));
  }

  const query = db.select().from(webhookEvents).orderBy(desc(webhookEvents.receivedAt)).limit(50);
  const rows =
    filters.length > 0
      ? await query.where(filters.length === 1 ? filters[0] : (filters[0] as SQL))
      : await query;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Activity</h2>
          <p className="text-sm text-muted-foreground">
            Last 50 webhook events. Filter, expand for full payload, retry failures.
          </p>
        </div>
        <ActivityFilters
          currentEventType={params.event_type ?? "all"}
          currentStatus={params.status ?? "all"}
        />
      </header>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Event type</TableHead>
              <TableHead className="w-[140px]">Status</TableHead>
              <TableHead className="w-[140px]">When</TableHead>
              <TableHead className="w-[60px] text-center">Retries</TableHead>
              <TableHead>Detail</TableHead>
              <TableHead className="w-[100px] text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  No webhook events match the current filters.
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-xs">{row.eventType}</TableCell>
                <TableCell>
                  <WebhookStatusBadge status={row.status} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground" title={row.receivedAt.toISOString()}>
                  {relativeTime(row.receivedAt)}
                </TableCell>
                <TableCell className="text-center text-xs">
                  {row.retryCount > 0 ? (
                    <Badge variant="secondary" className="font-mono">
                      {row.retryCount}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">·</span>
                  )}
                </TableCell>
                <TableCell className="max-w-md truncate font-mono text-xs text-muted-foreground" title={row.errorMessage ?? row.eventId}>
                  {row.errorMessage ?? row.eventId}
                </TableCell>
                <TableCell className="text-right">
                  {RETRYABLE_STATUSES.has(row.status) ? (
                    <RetryButton webhookEventId={row.id} />
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
