import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (_resend) return _resend;
  const key = process.env.AUTH_RESEND_KEY;
  if (!key) return null;
  _resend = new Resend(key);
  return _resend;
}

export type FailureAlertInput = {
  webhookEventId: string;
  eventType: string;
  errorMessage: string;
  retryCount: number;
};

/**
 * Fire-and-forget alert email when a webhook handler permanently fails.
 * Returns silently (logs to console only) when alerting isn't fully configured —
 * we never want alert delivery problems to surface as user-facing errors.
 */
export async function sendFailureAlert(input: FailureAlertInput): Promise<void> {
  const recipient = process.env.ALERT_EMAIL;
  const sender = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  const resend = getResend();

  if (!recipient || !resend) {
    if (!recipient) console.warn("[alert] ALERT_EMAIL not set — skipping email");
    if (!resend) console.warn("[alert] AUTH_RESEND_KEY not set — skipping email");
    return;
  }

  const dashboardBase =
    process.env.AUTH_URL ?? process.env.VERCEL_URL ?? "http://localhost:3000";
  const dashboardLink = `${dashboardBase.startsWith("http") ? dashboardBase : `https://${dashboardBase}`}/dashboard/activity`;

  const subject = `[LifeStarr] Webhook handler failed — ${input.eventType}`;

  const text = [
    `Event type: ${input.eventType}`,
    `Webhook event id: ${input.webhookEventId}`,
    `Retry count: ${input.retryCount}`,
    `Error: ${input.errorMessage}`,
    "",
    `View in dashboard: ${dashboardLink}`,
  ].join("\n");

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, sans-serif; line-height: 1.6">
      <h2 style="margin: 0 0 12px">LifeStarr webhook handler failed</h2>
      <p style="color: #444">A Mighty Networks webhook event couldn't be processed after exhausting retries.</p>
      <table style="margin: 16px 0; border-collapse: collapse">
        <tr><td style="padding: 4px 12px 4px 0; color: #666">Event type</td><td style="font-family: ui-monospace, monospace">${escape(input.eventType)}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #666">Webhook event id</td><td style="font-family: ui-monospace, monospace">${escape(input.webhookEventId)}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #666">Retry count</td><td>${input.retryCount}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #666; vertical-align: top">Error</td><td style="font-family: ui-monospace, monospace; max-width: 480px; word-break: break-word">${escape(input.errorMessage)}</td></tr>
      </table>
      <p>
        <a href="${dashboardLink}" style="background: #18181b; color: #fff; padding: 8px 16px; border-radius: 6px; text-decoration: none; display: inline-block">View in Activity feed</a>
      </p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: sender,
      to: recipient,
      subject,
      text,
      html,
    });
    console.log(`[alert] sent failure alert for ${input.webhookEventId}`);
  } catch (err) {
    console.error("[alert] Resend send failed:", err);
  }
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
