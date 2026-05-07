import { CheckCircle2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Check your email · LifeStarr Integration Hub",
};

export default function VerifyRequestPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            A sign-in link is on the way. Click it from any device to land in the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-center text-xs text-muted-foreground">
          <p>The link expires in 24 hours and can only be used once.</p>
          <p>You can close this tab.</p>
        </CardContent>
      </Card>
    </div>
  );
}
