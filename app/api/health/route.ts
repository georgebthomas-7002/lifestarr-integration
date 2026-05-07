import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight health check. Returns 200 if the DB round-trips and required
 * env vars are present. Used by external monitoring (e.g. UptimeRobot) and
 * by Mighty's webhook setup wizard for the "test connection" step.
 *
 * Auth.js middleware does NOT gate this route (matcher only covers /dashboard).
 */
export async function GET() {
  const checks: Record<string, "ok" | "missing" | "error"> = {
    db: "missing",
    mighty_secret: process.env.MIGHTY_WEBHOOK_SECRET ? "ok" : "missing",
    hubspot_token: process.env.HUBSPOT_API_TOKEN ? "ok" : "missing",
    hubspot_pipeline: process.env.HUBSPOT_CUSTOMER_PIPELINE_ID ? "ok" : "missing",
    hubspot_stage: process.env.HUBSPOT_NEW_PURCHASE_STAGE_ID ? "ok" : "missing",
    auth_secret: process.env.AUTH_SECRET ? "ok" : "missing",
    auth_resend_key: process.env.AUTH_RESEND_KEY ? "ok" : "missing",
    allowed_emails: process.env.ALLOWED_EMAILS ? "ok" : "missing",
  };

  try {
    const r = await db.execute(sql`SELECT 1 AS ok`);
    checks.db = r ? "ok" : "error";
  } catch (err) {
    checks.db = "error";
    return NextResponse.json(
      {
        status: "unhealthy",
        checks,
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }

  const allOk = Object.values(checks).every((v) => v === "ok");
  return NextResponse.json(
    {
      status: allOk ? "healthy" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "unknown",
    },
    { status: allOk ? 200 : 200 },
  );
}
