import { NextResponse } from "next/server";

import { getHealthStatus } from "@/lib/health";

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
  const report = await getHealthStatus();
  const status = report.status === "unhealthy" ? 503 : 200;
  return NextResponse.json(report, { status });
}
