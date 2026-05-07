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
 * Map Mighty plan info to our LifeStarr plan enum.
 *
 * NAME keywords are primary — "PREMIER" or "INTRO" in plan_name win.
 * This is required because LifeStarr's Premier plan has plan.type = "free"
 * (it's a free perk, not a paid subscription), so trusting plan.type alone
 * misclassified Premier as intro. The name is the ground truth.
 *
 * type and interval are tiebreakers when name doesn't say.
 *
 * Mighty's actual interval values are "month" / "year" (not "monthly" / "yearly").
 */
export function mapMightyPlan(plan: {
  plan_name?: string;
  plan_type?: string;
  interval?: string;
}): LifestarrPlan {
  const name = (plan.plan_name ?? "").toLowerCase();
  const type = (plan.plan_type ?? "").toLowerCase();
  const interval = (plan.interval ?? "").toLowerCase();

  if (name.includes("premier")) {
    if (interval === "year" || interval === "yearly" || interval === "annual" || name.includes("annual")) {
      return "premier_annual";
    }
    return "premier_monthly";
  }
  if (name.includes("intro")) return "intro";

  // Name didn't disambiguate — fall back to type/interval
  if (type === "paid") {
    if (interval === "year" || interval === "yearly" || interval === "annual") return "premier_annual";
    return "premier_monthly";
  }
  if (type === "free") return "intro";

  // Legacy fallback for events where neither name nor type hints
  if (interval === "year" || interval === "yearly") return "premier_annual";
  if (interval === "month" || interval === "monthly") return "premier_monthly";
  return "none";
}

export type MemberPayload = {
  id?: string | number;
  email: string;
  first_name?: string;
  last_name?: string;
  // Mighty profile fields available on MemberJoined / MemberUpdated
  bio?: string | null;
  avatar?: string | null;
  location?: string | null;
  time_zone?: string | null;
  permalink?: string;
  referral_count?: number;
  ambassador_level?: string;
  // Timestamps — Mighty uses `created_at` for join date; legacy `joined_at`
  // is the alias we expose to handlers via extractMember.
  created_at?: string;
  updated_at?: string;
  joined_at?: string;
  // Plan / monetization fields (MemberPurchased et al.)
  plan_id?: string | number;
  plan_name?: string;
  plan_type?: string; // Mighty: "free" | "paid"
  amount?: number;
  currency?: string;
  interval?: string; // Mighty uses "month" / "year" (not "monthly" / "yearly")
  purchased_at?: string;
  renewed_at?: string;
  canceled_at?: string;
  removed_at?: string;
};

/**
 * Mighty webhook payload shapes are inconsistent across event types:
 *
 *   Variant A (MemberJoined, MemberUpdated):
 *     { member: { id, email, first_name, ... }, network_id, space_id }
 *
 *   Variant B (MemberPurchased et al.):
 *     { plan, purchase, member_id, member_email, member_first_name, ... }
 *
 *   Variant C (older / unknown):
 *     { id, email, first_name, ... } — flat
 *
 * Plus `created_at` is Mighty's join date but our type uses `joined_at`.
 * This function normalizes all three shapes into a single MemberPayload.
 */
export function extractMember(payload: MightyWebhookPayload): MemberPayload {
  const p = payload.payload as Record<string, unknown>;

  let member: MemberPayload;

  if (p.member && typeof p.member === "object") {
    // Variant A — nested
    member = { ...(p.member as Record<string, unknown>) } as MemberPayload;
  } else if (typeof p.member_email === "string") {
    // Variant B — flat with member_* prefix
    member = {
      id: p.member_id as string | number | undefined,
      email: p.member_email,
      first_name: (p.member_first_name as string | undefined) ?? undefined,
      last_name: (p.member_last_name as string | undefined) ?? undefined,
      avatar: (p.member_avatar as string | null | undefined) ?? undefined,
      location: (p.member_location as string | null | undefined) ?? undefined,
      time_zone: (p.member_time_zone as string | null | undefined) ?? undefined,
      permalink: (p.member_permalink as string | undefined) ?? undefined,
      referral_count: p.member_referral_count as number | undefined,
      ambassador_level: (p.member_ambassador_level as string | undefined) ?? undefined,
    };
  } else {
    // Variant C — flat
    member = { ...p } as MemberPayload;
  }

  if (!member.joined_at && member.created_at) {
    member.joined_at = member.created_at;
  }

  // payload.plan: id, name, type (free/paid), amount, currency, interval (month/year)
  const planObj = p.plan as Record<string, unknown> | undefined;
  if (planObj) {
    if (member.plan_id === undefined && planObj.id !== undefined) {
      member.plan_id = planObj.id as string | number;
    }
    if (!member.plan_name && typeof planObj.name === "string") {
      member.plan_name = planObj.name;
    }
    if (!member.plan_type && typeof planObj.type === "string") {
      member.plan_type = planObj.type;
    }
    if (member.amount === undefined && typeof planObj.amount === "number") {
      member.amount = planObj.amount;
    }
    if (!member.currency && typeof planObj.currency === "string") {
      member.currency = planObj.currency;
    }
    if (!member.interval && typeof planObj.interval === "string") {
      member.interval = planObj.interval;
    }
  }

  // payload.purchase: id, purchased_at, ...
  const purchaseObj = p.purchase as Record<string, unknown> | undefined;
  if (purchaseObj && !member.purchased_at && typeof purchaseObj.purchased_at === "string") {
    member.purchased_at = purchaseObj.purchased_at;
  }

  return member;
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
  prefetchedExisting?: import("@hubspot/api-client/lib/codegen/crm/contacts").SimplePublicObject | null,
): Promise<UpsertResult> {
  return upsertContact({ ...input, mighty_match_status: matchStatus }, prefetchedExisting);
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
