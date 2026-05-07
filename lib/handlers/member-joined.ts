import {
  extractMember,
  flagNeedsReview,
  toIsoDate,
  upsertWithMatchStatus,
} from "@/lib/handler-utils";
import { findContactByEmail, updateContactProperties } from "@/lib/hubspot-client";
import type { HandlerResult, MightyWebhookPayload } from "@/lib/types";

export async function handleMemberJoined(
  payload: MightyWebhookPayload,
): Promise<HandlerResult> {
  const member = extractMember(payload);
  if (!member.email) return { success: false, message: "missing_email" };

  const existing = await findContactByEmail(member.email);
  const matchStatus = existing ? "matched" : "new_contact_unverified";
  const joinedDate = toIsoDate(member.joined_at);

  const { contact, created } = await upsertWithMatchStatus(
    {
      email: member.email,
      firstName: member.first_name,
      lastName: member.last_name,
      mighty_member_id: member.id !== undefined ? String(member.id) : undefined,
      lifestarr_plan: "intro",
      lifestarr_plan_status: "active",
      lifestarr_central_intro_account_created_date: joinedDate,
      lifestarr_central_account_created: true,
    },
    matchStatus,
  );

  // Set lifecyclestage separately. HubSpot can reject a "backward" transition
  // (e.g. customer → salesqualifiedlead) — when that happens, swallow the error
  // so the rest of the MemberJoined handler still records as success.
  try {
    await updateContactProperties(contact.id, { lifecyclestage: "salesqualifiedlead" });
  } catch (err) {
    console.warn(
      `[member-joined] lifecyclestage update skipped for ${contact.id}:`,
      err instanceof Error ? err.message : String(err),
    );
  }

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
