import { createDeal, findContactByEmail, updateContactProperties } from "@/lib/hubspot-client";
import {
  extractMember,
  flagNeedsReview,
  mapMightyPlan,
  toIsoDate,
  upsertWithMatchStatus,
} from "@/lib/handler-utils";
import type { HandlerResult, MightyWebhookPayload } from "@/lib/types";

export async function handleMemberPurchased(
  payload: MightyWebhookPayload,
): Promise<HandlerResult> {
  const member = extractMember(payload);

  if (!member.email) {
    return { success: false, message: "missing_email" };
  }

  const pipeline = process.env.HUBSPOT_CUSTOMER_PIPELINE_ID;
  const stage = process.env.HUBSPOT_NEW_PURCHASE_STAGE_ID;
  if (!pipeline || !stage) {
    return { success: false, message: "missing_pipeline_or_stage_env_var" };
  }

  const plan = mapMightyPlan(member);
  const startDate = toIsoDate(member.purchased_at);
  const existing = await findContactByEmail(member.email);
  const matchStatus = existing ? "matched" : "new_contact_unverified";

  // Pass `existing` to skip the duplicate findContactByEmail inside upsertContact.
  const { contact, created } = await upsertWithMatchStatus(
    {
      email: member.email,
      firstName: member.first_name,
      lastName: member.last_name,
      mighty_member_id: member.id !== undefined ? String(member.id) : undefined,
      lifestarr_plan: plan,
      lifestarr_plan_status: "active",
      lifestarr_premier_start_date: plan !== "intro" && plan !== "none" ? startDate : undefined,
    },
    matchStatus,
    existing,
  );

  if (created) {
    await flagNeedsReview({
      eventId: payload.event_id,
      email: member.email,
      mightyMemberId: String(member.id ?? ""),
      reason: "no_hubspot_match",
    });
  }

  // Mighty fires MemberPurchased on EVERY plan signup, including the free/intro
  // tier. For free plans we don't want a $0 "Closed won" deal cluttering the
  // pipeline — those joins are already covered by MemberJoined. Skip the deal.
  const isPaidPlan = plan === "premier_monthly" || plan === "premier_annual";

  // Lifecycle stage: paid Premier purchase → Customer. Free joins keep SQL.
  // Wrapped in try/catch so HubSpot's "no backward transition" rule never
  // breaks the rest of the handler.
  if (isPaidPlan) {
    try {
      await updateContactProperties(contact.id, { lifecyclestage: "customer" });
    } catch (err) {
      console.warn(
        `[member-purchased] lifecyclestage update skipped for ${contact.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  let dealId: string | undefined;
  if (isPaidPlan) {
    const deal = await createDeal({
      contactId: contact.id,
      dealName: `${member.first_name ?? "New"} ${member.last_name ?? "Member"} — ${member.plan_name ?? "LifeStarr"}`,
      amount: member.amount ?? 0,
      pipeline,
      stage,
      closeDate: startDate,
    });
    dealId = deal.id;
  }

  return {
    success: true,
    hubspotContactId: contact.id,
    hubspotDealId: dealId,
    needsReview: created,
    reviewReason: created ? "no_hubspot_match" : undefined,
    message: isPaidPlan
      ? created
        ? "premier_contact_created_and_flagged"
        : "premier_contact_matched"
      : created
        ? "free_contact_created_and_flagged"
        : "free_contact_matched_no_deal",
  };
}
