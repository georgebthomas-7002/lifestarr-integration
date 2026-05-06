import {
  extractMember,
  flagNeedsReview,
  upsertWithMatchStatus,
} from "@/lib/handler-utils";
import { findContactByEmail } from "@/lib/hubspot-client";
import type { HandlerResult, MightyWebhookPayload } from "@/lib/types";

export async function handleMemberJoined(
  payload: MightyWebhookPayload,
): Promise<HandlerResult> {
  const member = extractMember(payload);
  if (!member.email) return { success: false, message: "missing_email" };

  const existing = await findContactByEmail(member.email);
  const matchStatus = existing ? "matched" : "new_contact_unverified";

  const { contact, created } = await upsertWithMatchStatus(
    {
      email: member.email,
      firstName: member.first_name,
      lastName: member.last_name,
      mighty_member_id: member.id !== undefined ? String(member.id) : undefined,
      lifestarr_plan: "intro",
      lifestarr_plan_status: "active",
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

  return {
    success: true,
    hubspotContactId: contact.id,
    needsReview: created,
    reviewReason: created ? "no_hubspot_match" : undefined,
    message: created ? "contact_created_and_flagged" : "contact_matched",
  };
}
