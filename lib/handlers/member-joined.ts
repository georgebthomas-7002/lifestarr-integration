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
 * In both cases the payload includes `payload.space_id` at the top level.
 * On (1), it's the "default" community space. On (2), it's the specific
 * space they were added to. Mighty fires the event N times for someone
 * added to N spaces.
 *
 * Net behavior we want:
 *   - Identity / lifecycle / plan props: idempotent, set every time (cheap).
 *   - Space tracking: append the space to lifestarr_active_spaces, bump count.
 */
export async function handleMemberJoined(
  payload: MightyWebhookPayload,
): Promise<HandlerResult> {
  const member = extractMember(payload);
  if (!member.email) return { success: false, message: "missing_email" };

  const p = payload.payload as Record<string, unknown>;
  const spaceId = (p.space_id as string | number | undefined) ?? undefined;

  const existing = await findContactByEmail(member.email);
  const matchStatus = existing ? "matched" : "new_contact_unverified";
  const joinedDate = toIsoDate(member.joined_at);

  // Pass `existing` to skip the duplicate findContactByEmail inside upsertContact.
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

  // Lifecycle stage — separate update wrapped in try/catch so HubSpot's
  // "no backward transition" rule (customer → SQL) doesn't break the handler.
  try {
    await updateContactProperties(contact.id, { lifecyclestage: "salesqualifiedlead" });
  } catch (err) {
    console.warn(
      `[member-joined] lifecyclestage update skipped for ${contact.id}:`,
      err instanceof Error ? err.message : String(err),
    );
  }

  // Space tracking — when payload includes a space_id, append the space to
  // the contact's active spaces list. Read prior values from the just-fetched
  // contact when possible, else from `contact` (the upsert result).
  let spaceMessage: string | undefined;
  if (spaceId !== undefined) {
    const priorContactProps = (existing ?? contact).properties as Record<string, string> | undefined;
    const priorList = parseSpaceList(priorContactProps?.lifestarr_active_spaces);
    const label = spaceLabel(spaceId);
    if (!priorList.includes(label)) {
      const updatedList = [...priorList, label];
      await updateContactProperties(contact.id, {
        lifestarr_active_spaces: joinSpaceList(updatedList),
        lifestarr_last_space_joined_at: toIsoDate(member.joined_at),
        lifestarr_space_membership_count: updatedList.length,
      });
      const track = spaceTrack(spaceId);
      if (track) {
        await updateContactProperties(contact.id, { lifestarr_track: track });
      }
      spaceMessage = `+space[${label}]_total=${updatedList.length}${track ? `_track=${track}` : ""}`;
    } else {
      spaceMessage = `space[${label}]_already_recorded`;
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

function parseSpaceList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinSpaceList(spaces: string[]): string {
  return Array.from(new Set(spaces)).sort().join(", ");
}
