import { createDeal } from "@/lib/hubspot-client";
import {
  extractMember,
  flagNeedsReview,
  mapMightyPlan,
  toIsoDate,
  upsertWithMatchStatus,
} from "@/lib/handler-utils";
import type { HandlerResult, MightyWebhookPayload } from "@/lib/types";
import { findContactByEmail } from "@/lib/hubspot-client";

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
  );

  if (created) {
    await flagNeedsReview({
      eventId: payload.event_id,
      email: member.email,
      mightyMemberId: String(member.id ?? ""),
      reason: "no_hubspot_match",
    });
  }

  const deal = await createDeal({
    contactId: contact.id,
    dealName: `${member.first_name ?? "New"} ${member.last_name ?? "Member"} — ${member.plan_name ?? "LifeStarr"}`,
    amount: member.amount ?? 0,
    pipeline,
    stage,
    closeDate: startDate,
  });

  return {
    success: true,
    hubspotContactId: contact.id,
    hubspotDealId: deal.id,
    needsReview: created,
    reviewReason: created ? "no_hubspot_match" : undefined,
    message: created ? "contact_created_and_flagged" : "contact_matched",
  };
}
