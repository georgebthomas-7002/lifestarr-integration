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
 * Space tracking writes to two HubSpot properties for different uses:
 *   - lifestarr_spaces (multi-select): semicolon-separated space IDs.
 *     Use for HubSpot list filtering / segmentation. Source of truth.
 *   - lifestarr_active_spaces (text): comma-separated friendly names.
 *     Human-readable mirror, derived from the multi-select via SPACE_NAMES.
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

  // Space tracking. lifestarr_spaces is the source of truth (IDs); lifestarr_active_spaces
  // is a derived human-readable mirror.
  let spaceMessage: string | undefined;
  if (spaceId) {
    const priorProps = (existing ?? contact).properties as Record<string, string> | undefined;
    const priorIds = parseMultiSelect(priorProps?.lifestarr_spaces);

    if (!priorIds.includes(spaceId)) {
      const updatedIds = [...priorIds, spaceId];
      const updatedNames = updatedIds.map(spaceLabel);

      await updateContactProperties(contact.id, {
        lifestarr_spaces: joinMultiSelect(updatedIds),
        lifestarr_active_spaces: joinNames(updatedNames),
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

function joinNames(names: string[]): string {
  return Array.from(new Set(names)).join(", ");
}
