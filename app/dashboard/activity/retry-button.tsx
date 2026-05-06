"use client";

import { RotateCw } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { retryWebhook } from "../actions";

export function RetryButton({ webhookEventId }: { webhookEventId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const res = await retryWebhook(webhookEventId);
          if (res.ok) toast.success("Webhook retried");
          else toast.error(`Retry failed: ${res.error}`);
        });
      }}
    >
      <RotateCw className={`h-3 w-3 ${isPending ? "animate-spin" : ""}`} />
      <span className="ml-1.5">Retry</span>
    </Button>
  );
}
