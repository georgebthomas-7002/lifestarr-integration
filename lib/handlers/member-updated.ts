import {
  extractMember,
  flagNeedsReview,
  profileFieldsFromMember,
} from "@/lib/handler-utils";
import { findContactByEmail, updateContactProperties } from "@/lib/hubspot-client";
import type { HandlerResult, MightyWebhookPayload } from "@/lib/types";

/**
 * Mighty fires this when a member updates their profile (name, bio, location,
 * timezone, avatar, etc.). We refresh those fields in HubSpot.
 *
 * We deliberately do NOT touch lifecycle stage, plan, owner, or source
 * attribution — those belong to the lifecycle/monetization handlers and
 * should not be re-stamped on every profile edit.
 */
export async function handleMemberUpdated(
  payload: MightyWebhookPayload,
): Promise<HandlerResult> {
  const member = extractMember(payload);
  if (!member.email) return { success: false, message: "missing_email" };

  const existing = await findContactByEmail(member.email);
  if (!existing) {
    await flagNeedsReview({
      eventId: payload.event_id,
      email: member.email,
      mightyMemberId: String(member.id ?? ""),
      reason: "no_hubspot_match",
    });
    return {
      success: true,
      needsReview: true,
      reviewReason: "no_hubspot_match",
      message: "queued_for_review",
    };
  }

  // Identity fields (HubSpot-side keys)
  const updates: Record<string, string | number | null> = {};
  if (member.first_name !== undefined) updates.firstname = member.first_name;
  if (member.last_name !== undefined) updates.lastname = member.last_name;
  if (member.id !== undefined) updates.mighty_member_id = String(member.id);

  // Profile fields — same shape MemberJoined uses, so HubSpot stays consistent.
  // updateContactProperties handles undefined/null cleanly.
  Object.assign(updates, profileFieldsFromMember(member));

  if (Object.keys(updates).length > 0) {
    await updateContactProperties(existing.id, updates);
  }

  return {
    success: true,
    hubspotContactId: existing.id,
    message: Object.keys(updates).length > 0 ? "profile_synced" : "noop",
  };
}
