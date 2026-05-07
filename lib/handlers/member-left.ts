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
 * Mighty fires MemberLeft when a member leaves a Mighty Space. Same
 * payload shape as MemberJoined.
 *
 * NOTE: this is space-level departure, not "left the entire community".
 * Plan/lifecycle properties are managed by the dedicated subscription
 * handlers (Canceled / RemovedFromPlan), so we don't touch them here.
 */
export async function handleMemberLeft(
  payload: MightyWebhookPayload,
): Promise<HandlerResult> {
  const member = extractMember(payload);
  const p = payload.payload as Record<string, unknown>;
  const spaceIdRaw = p.space_id;
  const spaceId = spaceIdRaw !== undefined && spaceIdRaw !== null ? String(spaceIdRaw) : undefined;

  if (!spaceId) {
    return { success: false, message: "missing_space_id" };
  }

  let contact = member.email ? await findContactByEmail(member.email) : null;
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

  const props = contact.properties as Record<string, string> | undefined;
  const priorIds = parseMultiSelect(props?.lifestarr_spaces);
  const updatedIds = priorIds.filter((id) => id !== spaceId);
  const updatedNames = updatedIds.map(spaceLabel);

  await updateContactProperties(contact.id, {
    lifestarr_spaces: joinMultiSelect(updatedIds),
    lifestarr_active_spaces: joinNames(updatedNames),
    lifestarr_last_space_left_at: toIsoDate(member.removed_at) || todayISO(),
    lifestarr_space_membership_count: updatedIds.length,
  });

  return {
    success: true,
    hubspotContactId: contact.id,
    message: `-space[${spaceLabel(spaceId)}]_total=${updatedIds.length}`,
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
