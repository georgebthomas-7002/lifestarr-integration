import { LogOut } from "lucide-react";
import type { Metadata } from "next";

import { auth, signOut } from "@/auth";
import { DashboardNav } from "@/components/dashboard-nav";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "LifeStarr Integration Hub",
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[240px_1fr]">
      <aside className="hidden border-r bg-card md:block">
        <div className="flex h-14 items-center border-b px-5">
          <span className="text-sm font-semibold">LifeStarr</span>
          <span className="ml-2 text-xs text-muted-foreground">Integration Hub</span>
        </div>
        <DashboardNav />
      </aside>
      <div className="flex flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-card px-6">
          <h1 className="text-sm font-medium md:text-base">Operations Dashboard</h1>
          <div className="flex items-center gap-3 text-xs">
            {session?.user?.email ? (
              <>
                <span className="text-muted-foreground">{session.user.email}</span>
                <form action={handleSignOut}>
                  <Button type="submit" variant="ghost" size="sm">
                    <LogOut className="h-3 w-3" />
                    <span className="ml-1.5">Sign out</span>
                  </Button>
                </form>
              </>
            ) : (
              <span className="text-muted-foreground">unauthenticated</span>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-muted/40 p-6 md:p-8">{children}</main>
      </div>
      <Toaster richColors />
    </div>
  );
}
