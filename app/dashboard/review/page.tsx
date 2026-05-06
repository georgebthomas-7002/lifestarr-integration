import { desc, eq } from "drizzle-orm";
import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db, needsReviewQueue } from "@/lib/db";
import { relativeTime } from "@/lib/format-time";

import { ResolveButton } from "./resolve-button";
import { ReviewFilter } from "./filter";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ resolved?: string }>;
}) {
  const params = await searchParams;
  const showResolved = params.resolved === "true";

  const rows = await db
    .select()
    .from(needsReviewQueue)
    .where(eq(needsReviewQueue.resolved, showResolved))
    .orderBy(desc(needsReviewQueue.createdAt))
    .limit(100);

  const unresolvedCount = await db
    .select()
    .from(needsReviewQueue)
    .where(eq(needsReviewQueue.resolved, false));

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Needs Review</h2>
          <p className="text-sm text-muted-foreground">
            Members surfaced for manual reconciliation when the Mighty webhook couldn&apos;t be matched
            cleanly to a HubSpot record.
            <span className="ml-2 font-medium text-foreground">
              {unresolvedCount.length} unresolved
            </span>
          </p>
        </div>
        <ReviewFilter currentResolved={showResolved} />
      </header>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead className="w-[140px]">Mighty ID</TableHead>
              <TableHead className="w-[180px]">Reason</TableHead>
              <TableHead className="w-[140px]">When</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="w-[200px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  {showResolved
                    ? "No resolved review items yet."
                    : "Nothing in the queue. All Mighty events are landing on matched HubSpot contacts. 🎉"}
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-xs">{row.mightyEmail ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {row.mightyMemberId ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {row.reason}
                  </Badge>
                </TableCell>
                <TableCell
                  className="text-xs text-muted-foreground"
                  title={row.createdAt.toISOString()}
                >
                  {relativeTime(row.createdAt)}
                </TableCell>
                <TableCell className="max-w-md text-xs text-muted-foreground">
                  {row.notes ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {row.mightyEmail && (
                      <a
                        href={`https://app.hubspot.com/contacts/all/?query=${encodeURIComponent(row.mightyEmail)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button size="sm" variant="outline">
                          <ExternalLink className="h-3 w-3" />
                          <span className="ml-1.5">HubSpot</span>
                        </Button>
                      </a>
                    )}
                    {!row.resolved && <ResolveButton reviewId={row.id} />}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
