import { auth } from "@/auth";

/**
 * Next.js 16 "proxy" convention (replaces middleware.ts).
 * Runs on Node.js runtime by default — required for Auth.js + Drizzle
 * to load without Edge-runtime restrictions.
 *
 * Auth gating here is defense-in-depth — the dashboard layout also
 * resolves `auth()` server-side so layouts/pages reflect the right
 * session even if this redirect is bypassed.
 */

// Auth gate is enforced. Resend's lifestarr.com domain is verified, so all
// allowlisted users can receive magic-link emails from mail@lifestarr.com.
// Flipping this to true would re-disable the gate (emergency dashboard
// access) — don't do that without a really good reason.
const BYPASS_AUTH = false;

export default auth((req) => {
  if (BYPASS_AUTH) return;
  if (!req.auth && req.nextUrl.pathname.startsWith("/dashboard")) {
    const url = new URL("/login", req.nextUrl.origin);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
