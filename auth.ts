import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";

import { accounts, db, sessions, users, verificationTokens } from "@/lib/db";

const resendKey = process.env.AUTH_RESEND_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

function allowlist(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Resend({
      apiKey: resendKey,
      from: fromEmail,
      async sendVerificationRequest({ identifier: email, url }) {
        const host = new URL(url).host;
        const subject = `Sign in to LifeStarr Integration Hub`;

        const text = [
          `Hey,`,
          ``,
          `Click the link below to sign in to LifeStarr Integration Hub:`,
          ``,
          url,
          ``,
          `This link expires in 24 hours and can only be used once.`,
          `If you didn't request this, you can safely ignore the email.`,
          ``,
          `— LifeStarr Ops`,
        ].join("\n");

        const html = `
          <div style="font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; max-width: 480px; margin: 32px auto; padding: 0 16px; line-height: 1.6; color: #18181b">
            <h1 style="font-size: 22px; font-weight: 600; margin: 0 0 8px">Sign in to LifeStarr Integration Hub</h1>
            <p style="color: #52525b; margin: 0 0 24px">Click the button below to finish signing in. This link expires in 24 hours.</p>
            <p style="margin: 0 0 24px">
              <a href="${url}" style="display: inline-block; background: #18181b; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500">Sign in</a>
            </p>
            <p style="color: #71717a; font-size: 13px; margin: 0 0 8px">Or paste this URL into your browser:</p>
            <p style="word-break: break-all; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #52525b; margin: 0 0 32px">${url}</p>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0" />
            <p style="color: #a1a1aa; font-size: 12px; margin: 0">
              If you didn't request this, you can safely ignore this email.<br/>
              Sent from ${host}.
            </p>
          </div>
        `;

        if (!resendKey) {
          throw new Error(
            "AUTH_RESEND_KEY is not set — magic-link emails cannot be sent.",
          );
        }

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: email,
            subject,
            text,
            html,
          }),
        });

        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Resend error (${res.status}): ${body}`);
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/verify-request",
    error: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      const allowed = allowlist();
      if (allowed.length === 0) {
        console.warn(
          "[auth] ALLOWED_EMAILS is empty — rejecting all sign-ins. Set ALLOWED_EMAILS to a comma-separated list.",
        );
        return false;
      }
      if (!user.email) return false;
      return allowed.includes(user.email.toLowerCase());
    },
  },
  session: { strategy: "database" },
  trustHost: true,
});
