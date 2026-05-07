import { Mail } from "lucide-react";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Sign in · LifeStarr Integration Hub",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function handleSignIn(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    if (!email) return;
    try {
      await signIn("resend", { email, redirectTo: "/dashboard" });
    } catch (err) {
      // The success path throws a NEXT_REDIRECT — re-throw so Next can navigate.
      if (isRedirectError(err)) throw err;
      // Otherwise (e.g. Resend API 403), surface a visible error.
      console.error("[login] signIn failed:", err);
      redirect("/login?error=SendFailed");
    }
  }

  if (error === "SendFailed") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Couldn&apos;t send the magic link</CardTitle>
            <CardDescription className="space-y-2">
              <span className="block">
                The email send failed. Most likely cause: the Resend sender domain
                (<code className="font-mono text-xs">RESEND_FROM_EMAIL</code>) isn&apos;t verified
                yet, or your email isn&apos;t on the Resend account&apos;s allowlist (sandbox mode).
              </span>
              <span className="block">
                Check Vercel runtime logs for the exact Resend response, or have the Resend
                account owner verify the domain at{" "}
                <a
                  className="underline"
                  href="https://resend.com/domains"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  resend.com/domains
                </a>
                .
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/login">
              <Button variant="outline" className="w-full">
                Try again
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Auth.js routes "AccessDenied" here when the signIn callback returns false.
  if (error === "AccessDenied") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
            <CardDescription>
              Your email isn&apos;t on the LifeStarr Integration Hub allowlist. Contact George
              Thomas to be added.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/login">
              <Button variant="outline" className="w-full">
                Try a different email
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <CardTitle>Sign in to LifeStarr Integration Hub</CardTitle>
          <CardDescription>
            Magic-link authentication. Enter your email and we&apos;ll send a sign-in link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSignIn} className="space-y-3">
            <input
              name="email"
              type="email"
              required
              autoFocus
              placeholder="you@yourcompany.com"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button type="submit" className="w-full">
              Send magic link
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            By signing in, you confirm you&apos;re authorized to access LifeStarr operational data.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
