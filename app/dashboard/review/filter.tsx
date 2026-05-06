"use client";

import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function ReviewFilter({ currentResolved }: { currentResolved: boolean }) {
  const router = useRouter();
  const pathname = usePathname();

  function set(resolved: boolean) {
    const url = resolved ? `${pathname}?resolved=true` : pathname;
    router.push(url);
  }

  return (
    <div className="inline-flex rounded-md border bg-background">
      <Button
        size="sm"
        variant={currentResolved ? "ghost" : "default"}
        className="rounded-r-none"
        onClick={() => set(false)}
      >
        Unresolved
      </Button>
      <Button
        size="sm"
        variant={currentResolved ? "default" : "ghost"}
        className="rounded-l-none"
        onClick={() => set(true)}
      >
        Resolved
      </Button>
    </div>
  );
}
