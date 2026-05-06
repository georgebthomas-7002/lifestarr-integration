"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { toggleIntegrationStatus } from "./actions";

export function StatusToggle({
  eventType,
  status,
}: {
  eventType: string;
  status: "live" | "paused";
}) {
  const [isPending, startTransition] = useTransition();
  const isLive = status === "live";

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2">
      <span className="text-xs font-medium">{isLive ? "Active" : "Paused"}</span>
      <Switch
        checked={isLive}
        disabled={isPending}
        onCheckedChange={() => {
          startTransition(async () => {
            const res = await toggleIntegrationStatus(eventType);
            if (res.ok) {
              toast.success(`Integration ${res.status === "live" ? "resumed" : "paused"}`);
            } else {
              toast.error(`Toggle failed: ${res.error}`);
            }
          });
        }}
      />
    </div>
  );
}
