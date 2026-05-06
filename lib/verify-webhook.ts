import { timingSafeEqual } from "node:crypto";

export function verifyMightyWebhook(req: Request): boolean {
  const expected = process.env.MIGHTY_WEBHOOK_SECRET;
  if (!expected) return false;

  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) return false;

  const token = auth.slice("Bearer ".length).trim();
  if (token.length !== expected.length) return false;

  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}
