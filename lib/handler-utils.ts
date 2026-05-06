import { db, needsReviewQueue, webhookEvents } from "@/lib/db";
import {
  findContactByEmail,
  upsertContact,
  type ContactInput,
  type UpsertResult,
} from "@/lib/hubspot-client";
import type { LifestarrPlan } from "@/lib/hubspot-properties";
import type { MightyWebhookPayload } from "@/lib/types";
import { eq } from "drizzle-orm";

/**
 * Map a Mighty plan_name + interval into our LifeStarr plan enum.
 * Adjust these heuristics once we have the actual plan names from production Mighty.
 */
export function mapMightyPlan(plan: {
  plan_name?: string;
  interval?: string;
}): LifestarrPlan {
  const name = (plan.plan_name ?? "").toLowerCase();
  const interval = (plan.interval ?? "").toLowerCase();

  if (name.includes("intro")) return "intro";
  if (name.includes("annual") || interval === "annual" || interval === "yearly") {
    return "premier_annual";
  }
  if (name.includes("premier") || interval === "monthly") return "premier_monthly";
  return "none";
}

export type MemberPayload = {
  id?: string | number;
  email: string;
  first_name?: string;
  last_name?: string;
  plan_id?: string | number;
  plan_name?: string;
  amount?: number;
  currency?: string;
  interval?: string;
  purchased_at?: string;
  renewed_at?: string;
  canceled_at?: string;
  removed_at?: string;
  joined_at?: string;
};

export function extractMember(payload: MightyWebhookPayload): MemberPayload {
  return payload.payload as MemberPayload;
}

/**
 * Find an existing HubSpot contact for this Mighty member.
 * If the contact doesn't exist, push the event to needs_review_queue
 * and return null so the caller can decide whether to skip or create new.
 */
export async function findContactForMighty(opts: {
  payload: MightyWebhookPayload;
  reason: string;
}): Promise<{ contactId: string; existing: true } | null> {
  const member = extractMember(opts.payload);
  const contact = await findContactByEmail(member.email);
  if (contact) return { contactId: contact.id, existing: true };

  await flagNeedsReview({
    eventId: opts.payload.event_id,
    email: member.email,
    mightyMemberId: String(member.id ?? ""),
    reason: opts.reason,
  });
  return null;
}

export async function flagNeedsReview(opts: {
  eventId: string;
  email: string;
  mightyMemberId: string;
  reason: string;
}) {
  const rows = await db
    .select({ id: webhookEvents.id })
    .from(webhookEvents)
    .where(eq(webhookEvents.eventId, opts.eventId))
    .limit(1);

  await db.insert(needsReviewQueue).values({
    webhookEventId: rows[0]?.id ?? null,
    mightyEmail: opts.email,
    mightyMemberId: opts.mightyMemberId,
    reason: opts.reason,
  });
}

export async function upsertWithMatchStatus(
  input: Omit<ContactInput, "mighty_match_status">,
  matchStatus: "matched" | "new_contact_unverified" | "duplicate_review_needed",
): Promise<UpsertResult> {
  return upsertContact({ ...input, mighty_match_status: matchStatus });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function toIsoDate(input?: string): string {
  if (!input) return todayISO();
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return todayISO();
  return d.toISOString().slice(0, 10);
}
