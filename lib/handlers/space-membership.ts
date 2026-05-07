import { eq } from "drizzle-orm";

import { db, needsReviewQueue, webhookEvents } from "@/lib/db";
import {
  findContactByEmail,
  findContactByMightyMemberId,
  updateContactProperties,
} from "@/lib/hubspot-client";
import { spaceLabel, spaceTrack } from "@/lib/space-config";
import { todayISO } from "@/lib/handler-utils";
import type { HandlerResult, MightyWebhookPayload } from "@/lib/types";

/**
 * Mighty's space-membership events have an unconfirmed payload shape (we'll
 * lock it down once a real one lands in /dashboard/activity). Defensively
 * looks for space_id and member_id in several plausible locations.
 */
type SpaceMembershipPayload = {
  space_id?: string | number;
  space?: { id?: string | number; name?: string };
  member_id?: string | number;
  member?: { id?: string | number; email?: string };
  member_email?: string;
  added_at?: string;
  removed_at?: string;
};

function extractSpaceMembership(payload: MightyWebhookPayload) {
  const p = payload.payload as SpaceMembershipPayload;
  const spaceId = p.space_id ?? p.space?.id;
  const spaceName = p.space?.name; // sometimes Mighty includes the name inline
  const memberId = p.member_id ?? p.member?.id;
  const memberEmail = p.member_email ?? p.member?.email;
  return {
    spaceId,
    spaceName,
    memberId,
    memberEmail,
    addedAt: p.added_at,
    removedAt: p.removed_at,
  };
}

async function locateContact(opts: {
  email?: string;
  memberId?: string | number;
  eventId: string;
}) {
  if (opts.email) {
    const c = await findContactByEmail(opts.email);
    if (c) return c;
  }
  if (opts.memberId !== undefined) {
    const c = await findContactByMightyMemberId(opts.memberId);
    if (c) return c;
  }

  // Couldn't resolve — flag for review.
  const rows = await db
    .select({ id: webhookEvents.id })
    .from(webhookEvents)
    .where(eq(webhookEvents.eventId, opts.eventId))
    .limit(1);

  await db.insert(needsReviewQueue).values({
    webhookEventId: rows[0]?.id ?? null,
    mightyEmail: opts.email ?? null,
    mightyMemberId: opts.memberId !== undefined ? String(opts.memberId) : null,
    reason: "no_hubspot_match_for_space_event",
  });

  return null;
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

export async function handleSpaceMemberAdded(
  payload: MightyWebhookPayload,
): Promise<HandlerResult> {
  const { spaceId, spaceName, memberEmail, memberId, addedAt } = extractSpaceMembership(payload);

  if (spaceId === undefined && memberId === undefined && !memberEmail) {
    return { success: false, message: "missing_space_or_member_id" };
  }

  const contact = await locateContact({
    email: memberEmail,
    memberId,
    eventId: payload.event_id,
  });
  if (!contact) {
    return {
      success: true,
      needsReview: true,
      reviewReason: "no_hubspot_match_for_space_event",
      message: "queued_for_review",
    };
  }

  const existingSpaces = parseSpaceList(
    contact.properties?.lifestarr_active_spaces as string | undefined,
  );
  const existingCount = parseInt(
    (contact.properties?.lifestarr_space_membership_count as string | undefined) ?? "0",
    10,
  );

  const label = spaceName ?? spaceLabel(spaceId);
  const updatedSpaces = [...existingSpaces, label];
  const newList = joinSpaceList(updatedSpaces);
  const newCount = Array.from(new Set(updatedSpaces)).length;

  const track = spaceTrack(spaceId);

  await updateContactProperties(contact.id, {
    lifestarr_active_spaces: newList,
    lifestarr_last_space_joined_at:
      typeof addedAt === "string" ? addedAt.slice(0, 10) : todayISO(),
    lifestarr_space_membership_count: newCount,
    ...(track ? { lifestarr_track: track } : {}),
  });

  return {
    success: true,
    hubspotContactId: contact.id,
    message: `joined_space[${label}]${track ? `_track=${track}` : ""}_total=${newCount}`,
  };
}

export async function handleSpaceMemberRemoved(
  payload: MightyWebhookPayload,
): Promise<HandlerResult> {
  const { spaceId, spaceName, memberEmail, memberId, removedAt } =
    extractSpaceMembership(payload);

  if (spaceId === undefined && memberId === undefined && !memberEmail) {
    return { success: false, message: "missing_space_or_member_id" };
  }

  const contact = await locateContact({
    email: memberEmail,
    memberId,
    eventId: payload.event_id,
  });
  if (!contact) {
    return {
      success: true,
      needsReview: true,
      reviewReason: "no_hubspot_match_for_space_event",
      message: "queued_for_review",
    };
  }

  const existingSpaces = parseSpaceList(
    contact.properties?.lifestarr_active_spaces as string | undefined,
  );

  const label = spaceName ?? spaceLabel(spaceId);
  const updatedSpaces = existingSpaces.filter((s) => s !== label);
  const newList = joinSpaceList(updatedSpaces);
  const newCount = updatedSpaces.length;

  await updateContactProperties(contact.id, {
    lifestarr_active_spaces: newList,
    lifestarr_last_space_left_at:
      typeof removedAt === "string" ? removedAt.slice(0, 10) : todayISO(),
    lifestarr_space_membership_count: newCount,
  });

  return {
    success: true,
    hubspotContactId: contact.id,
    message: `left_space[${label}]_total=${newCount}`,
  };
}
