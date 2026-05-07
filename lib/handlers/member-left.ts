import {
  extractMember,
  flagNeedsReview,
  todayISO,
  toIsoDate,
} from "@/lib/handler-utils";
import {
  findContactByEmail,
  findContactByMightyMemberId,
  updateContactProperties,
} from "@/lib/hubspot-client";
import { spaceLabel } from "@/lib/space-config";
import type { HandlerResult, MightyWebhookPayload } from "@/lib/types";

/**
 * Mighty fires MemberLeft when a member leaves a Mighty Space.
 * Payload shape mirrors MemberJoined:
 *   {
 *     member: { id, email, first_name, ... },
 *     space_id: 18257656,
 *     network_id: 12946344
 *   }
 *
 * NOTE: this is space-level departure, not "left the entire community".
 * Plan/lifecycle properties are managed by the dedicated subscription
 * handlers (Canceled / RemovedFromPlan), so we deliberately don't touch
 * them here.
 */
export async function handleMemberLeft(
  payload: MightyWebhookPayload,
): Promise<HandlerResult> {
  const member = extractMember(payload);
  const p = payload.payload as Record<string, unknown>;
  const spaceId = (p.space_id as string | number | undefined) ?? undefined;

  if (spaceId === undefined) {
    return { success: false, message: "missing_space_id" };
  }

  // Try email first, fall back to mighty_member_id lookup
  let contact =
    member.email ? await findContactByEmail(member.email) : null;
  if (!contact && member.id !== undefined) {
    contact = await findContactByMightyMemberId(member.id);
  }
  if (!contact) {
    await flagNeedsReview({
      eventId: payload.event_id,
      email: member.email ?? "",
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

  const priorList = parseSpaceList(
    (contact.properties as Record<string, string> | undefined)?.lifestarr_active_spaces,
  );
  const label = spaceLabel(spaceId);
  const updatedList = priorList.filter((s) => s !== label);

  await updateContactProperties(contact.id, {
    lifestarr_active_spaces: joinSpaceList(updatedList),
    lifestarr_last_space_left_at: toIsoDate(member.removed_at) || todayISO(),
    lifestarr_space_membership_count: updatedList.length,
  });

  return {
    success: true,
    hubspotContactId: contact.id,
    message: `-space[${label}]_total=${updatedList.length}`,
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
