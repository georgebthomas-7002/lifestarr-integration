"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const EVENT_TYPES = [
  "all",
  "MemberJoined",
  "MemberPurchased",
  "MemberPlanChanged",
  "MemberSubscriptionCanceled",
  "MemberSubscriptionRenewed",
  "MemberRemovedFromPlan",
  "MemberCourseProgressStarted",
  "MemberCourseProgressCompleted",
  "PostCreated",
  "CommentCreated",
  "RsvpCreated",
  "ReactionCreated",
];

const STATUSES = ["all", "success", "failed", "needs_review", "retrying", "pending", "no_handler_registered"];

export function ActivityFilters({
  currentEventType,
  currentStatus,
}: {
  currentEventType: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "all") next.delete(key);
    else next.set(key, value);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex gap-2">
      <select
        value={currentEventType}
        onChange={(e) => setParam("event_type", e.target.value)}
        className="rounded-md border bg-background px-3 py-1.5 text-xs"
      >
        {EVENT_TYPES.map((t) => (
          <option key={t} value={t}>
            {t === "all" ? "All event types" : t}
          </option>
        ))}
      </select>
      <select
        value={currentStatus}
        onChange={(e) => setParam("status", e.target.value)}
        className="rounded-md border bg-background px-3 py-1.5 text-xs"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s === "all" ? "All statuses" : s}
          </option>
        ))}
      </select>
    </div>
  );
}
