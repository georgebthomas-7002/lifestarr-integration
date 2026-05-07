import { sql } from "drizzle-orm";

import { db } from "@/lib/db";

export type HealthCheck = "ok" | "missing" | "error";

export type HealthReport = {
  status: "healthy" | "degraded" | "unhealthy";
  checks: Record<string, HealthCheck>;
  timestamp: string;
  commit: string;
  error?: string;
};

/**
 * Single source of truth for health-check logic. Used by both /api/health
 * (external monitoring) and the dashboard layout's health badge.
 */
export async function getHealthStatus(): Promise<HealthReport> {
  const checks: Record<string, HealthCheck> = {
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
    return {
      status: "unhealthy",
      checks,
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "unknown",
    };
  }

  const allOk = Object.values(checks).every((v) => v === "ok");
  return {
    status: allOk ? "healthy" : "degraded",
    checks,
    timestamp: new Date().toISOString(),
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "unknown",
  };
}
