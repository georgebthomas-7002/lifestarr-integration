"use client";

import { Activity, AlertCircle, GitBranch, LayoutDashboard, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Status", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/activity", label: "Activity", icon: Activity, exact: false },
  { href: "/dashboard/progress", label: "Build Progress", icon: GitBranch, exact: false },
  { href: "/dashboard/engagement", label: "Engagement", icon: Sparkles, exact: false },
  { href: "/dashboard/review", label: "Needs Review", icon: AlertCircle, exact: false },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, exact: false },
];

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV_ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
