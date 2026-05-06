import {
  extractMember,
  findContactForMighty,
  toIsoDate,
} from "@/lib/handler-utils";
import { updateContactProperties } from "@/lib/hubspot-client";
import type { HandlerResult, MightyWebhookPayload } from "@/lib/types";

export async function handleMemberSubscriptionRenewed(
  payload: MightyWebhookPayload,
): Promise<HandlerResult> {
  const member = extractMember(payload);
  const match = await findContactForMighty({ payload, reason: "no_hubspot_match" });
  if (!match) {
    return {
      success: true,
      needsReview: true,
      reviewReason: "no_hubspot_match",
      message: "queued_for_review",
    };
  }

  await updateContactProperties(match.contactId, {
    lifestarr_premier_renewal_date: toIsoDate(member.renewed_at ?? member.purchased_at),
    lifestarr_plan_status: "active",
  });

  return {
    success: true,
    hubspotContactId: match.contactId,
    message: "renewal_logged",
  };
}
