"use client";

import { Check } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { markReviewResolved } from "../actions";

export function ResolveButton({ reviewId }: { reviewId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const res = await markReviewResolved(reviewId, "manual-dashboard-action");
          if (res.ok) toast.success("Marked resolved");
          else toast.error("Failed to resolve");
        });
      }}
    >
      <Check className="h-3 w-3" />
      <span className="ml-1.5">Resolve</span>
    </Button>
  );
}
