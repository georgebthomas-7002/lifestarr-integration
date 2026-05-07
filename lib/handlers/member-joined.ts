import {
  extractMember,
  flagNeedsReview,
  profileFieldsFromMember,
  toIsoDate,
  upsertWithMatchStatus,
} from "@/lib/handler-utils";
import { findContactByEmail, updateContactProperties } from "@/lib/hubspot-client";
import { spaceLabel, spaceTrack } from "@/lib/space-config";
import type { HandlerResult, MightyWebhookPayload } from "@/lib/types";

/**
 * Mighty fires MemberJoined for two scenarios — and the payload structure
 * is the same for both:
 *   1. Member joined the community (initial signup)
 *   2. Member was added to a Mighty Space within the community
 *
 * Both cases include `payload.space_id`. Mighty fires the event N times for
 * someone added to N spaces, so we treat each fire as an idempotent upsert.
 *
 * Space tracking writes to lifestarr_spaces (multi-select), where each option
 * is keyed by space_id with the friendly name as its label. HubSpot's UI
 * shows the names as chips on the contact record AND lets lists filter by
 * "is any of [Foundation Path, Decision Coach]".
 */
export async function handleMemberJoined(
  payload: MightyWebhookPayload,
): Promise<HandlerResult> {
  const member = extractMember(payload);
  if (!member.email) return { success: false, message: "missing_email" };

  const p = payload.payload as Record<string, unknown>;
  const spaceIdRaw = p.space_id;
  const spaceId = spaceIdRaw !== undefined && spaceIdRaw !== null ? String(spaceIdRaw) : undefined;

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
      ...profileFieldsFromMember(member),
    },
    matchStatus,
    existing,
  );

  try {
    await updateContactProperties(contact.id, { lifecyclestage: "salesqualifiedlead" });
  } catch (err) {
    console.warn(
      `[member-joined] lifecyclestage update skipped for ${contact.id}:`,
      err instanceof Error ? err.message : String(err),
    );
  }

  // Space tracking via the multi-select (HubSpot renders the friendly names).
  let spaceMessage: string | undefined;
  if (spaceId) {
    const priorProps = (existing ?? contact).properties as Record<string, string> | undefined;
    const priorIds = parseMultiSelect(priorProps?.lifestarr_spaces);

    if (!priorIds.includes(spaceId)) {
      const updatedIds = [...priorIds, spaceId];

      await updateContactProperties(contact.id, {
        lifestarr_spaces: joinMultiSelect(updatedIds),
        lifestarr_last_space_joined_at: toIsoDate(member.joined_at),
        lifestarr_space_membership_count: updatedIds.length,
      });

      const track = spaceTrack(spaceId);
      if (track) {
        try {
          await updateContactProperties(contact.id, { lifestarr_track: track });
        } catch (err) {
          console.warn(
            `[member-joined] track update skipped for ${contact.id}:`,
            err instanceof Error ? err.message : String(err),
          );
        }
      }

      spaceMessage = `+space[${spaceLabel(spaceId)}]_total=${updatedIds.length}${
        track ? `_track=${track}` : ""
      }`;
    } else {
      spaceMessage = `space[${spaceLabel(spaceId)}]_already_recorded`;
    }
  }

  if (created) {
    await flagNeedsReview({
      eventId: payload.event_id,
      email: member.email,
      mightyMemberId: String(member.id ?? ""),
      reason: "no_hubspot_match",
    });
  }

  const baseMsg = created ? "contact_created_and_flagged" : "contact_matched";
  return {
    success: true,
    hubspotContactId: contact.id,
    needsReview: created,
    reviewReason: created ? "no_hubspot_match" : undefined,
    message: spaceMessage ? `${baseMsg} | ${spaceMessage}` : baseMsg,
  };
}

function parseMultiSelect(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinMultiSelect(ids: string[]): string {
  return Array.from(new Set(ids)).join(";");
}
