import { findContactForMighty } from "@/lib/handler-utils";
import { updateContactProperties } from "@/lib/hubspot-client";
import type { HandlerResult, MightyWebhookPayload } from "@/lib/types";

export async function handleMemberSubscriptionCanceled(
  payload: MightyWebhookPayload,
): Promise<HandlerResult> {
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
    lifestarr_plan_status: "canceled",
  });

  return {
    success: true,
    hubspotContactId: match.contactId,
    message: "marked_canceled",
  };
}
