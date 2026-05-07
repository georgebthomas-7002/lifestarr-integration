import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configuration overview. Most values live in the project&apos;s environment variables on
          Vercel.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Authentication</CardTitle>
            <CardDescription>Magic-link sign-in via Resend (Auth.js v5).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="font-mono text-xs">Phase 3 — pending Resend domain verification</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Allowlist</span>
              <span className="font-mono text-xs">env: ALLOWED_EMAILS</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">HubSpot</CardTitle>
            <CardDescription>Custom property group + Customer Pipeline.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Property group</span>
              <span className="font-mono text-xs">lifestarr</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pipeline</span>
              <span className="font-mono text-xs">env: HUBSPOT_CUSTOMER_PIPELINE_ID</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Initial stage</span>
              <span className="font-mono text-xs">env: HUBSPOT_NEW_PURCHASE_STAGE_ID</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mighty Webhook</CardTitle>
            <CardDescription>Bearer-token authenticated POST endpoint.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">URL</span>
              <span className="font-mono text-xs">/api/webhook</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Auth</span>
              <span className="font-mono text-xs">Authorization: Bearer &lt;secret&gt;</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Engagement scoring</CardTitle>
            <CardDescription>Tunable thresholds in lib/engagement.ts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Window</span>
              <span className="font-mono text-xs">30 days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Premier ready threshold</span>
              <span className="font-mono text-xs">50 points</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
