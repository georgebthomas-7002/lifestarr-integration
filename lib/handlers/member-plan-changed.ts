import {
  extractMember,
  findContactForMighty,
  mapMightyPlan,
} from "@/lib/handler-utils";
import { updateContactProperties } from "@/lib/hubspot-client";
import type { HandlerResult, MightyWebhookPayload } from "@/lib/types";

export async function handleMemberPlanChanged(
  payload: MightyWebhookPayload,
): Promise<HandlerResult> {
  const member = extractMember(payload);
  if (!member.email) return { success: false, message: "missing_email" };

  const match = await findContactForMighty({ payload, reason: "no_hubspot_match" });
  if (!match) {
    return {
      success: true,
      needsReview: true,
      reviewReason: "no_hubspot_match",
      message: "queued_for_review",
    };
  }

  const plan = mapMightyPlan(member);
  await updateContactProperties(match.contactId, {
    lifestarr_plan: plan,
    lifestarr_plan_status: "active",
  });

  return {
    success: true,
    hubspotContactId: match.contactId,
    message: `plan_updated_to_${plan}`,
  };
}
