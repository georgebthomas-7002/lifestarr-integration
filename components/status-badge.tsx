import { Badge } from "@/components/ui/badge";
import type { IntegrationStatus, WebhookEventStatus } from "@/lib/db";

export function IntegrationStatusBadge({ status }: { status: IntegrationStatus }) {
  const variants: Record<
    IntegrationStatus,
    { className: string; label: string }
  > = {
    live: {
      className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      label: "Live",
    },
    paused: {
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
      label: "Paused",
    },
    building: {
      className: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
      label: "Building",
    },
    not_started: {
      className: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 border-zinc-500/30",
      label: "Not started",
    },
  };
  const v = variants[status];
  return (
    <Badge variant="outline" className={v.className}>
      {v.label}
    </Badge>
  );
}

export function WebhookStatusBadge({ status }: { status: WebhookEventStatus }) {
  const variants: Record<WebhookEventStatus, { className: string; label: string }> = {
    success: {
      className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      label: "Success",
    },
    failed: {
      className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
      label: "Failed",
    },
    needs_review: {
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
      label: "Needs review",
    },
    pending: {
      className: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
      label: "Pending",
    },
    retrying: {
      className: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
      label: "Retrying",
    },
    no_handler_registered: {
      className: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30",
      label: "No handler",
    },
  };
  const v = variants[status];
  return (
    <Badge variant="outline" className={v.className}>
      {v.label}
    </Badge>
  );
}
