import {
  ENGAGEMENT_EVENT_POINTS,
  recordEngagementEvent,
  syncEngagementToHubspot,
  type EngagementEventType,
} from "@/lib/engagement";
import { findContactByMightyMemberId } from "@/lib/hubspot-client";
import type { HandlerResult, MightyWebhookPayload } from "@/lib/types";

/**
 * Engagement payload shapes vary across Mighty event types:
 *   - PostCreated:       creator_id + content fields, NO email
 *   - CommentCreated:    likely creator_id + post_id, possibly NO email
 *   - ReactionCreated:   likely creator_id + target_id
 *   - RsvpCreated:       member_id + event details
 *   - CourseProgress*:   member_id-style payload
 *
 * Strategy:
 *   1. Probe likely email locations
 *   2. If none, take whichever member_id-shaped field is present and
 *      look up the HubSpot contact by mighty_member_id to get the email
 *   3. If neither — flag for review
 */
type RawPayload = Record<string, unknown> & {
  id?: string | number;
  email?: string;
  author?: { id?: string | number; email?: string };
  member?: { id?: string | number; email?: string };
  user?: { id?: string | number; email?: string };
  creator_id?: string | number;
  member_id?: string | number;
  author_id?: string | number;
  user_id?: string | number;
};

async function extractActor(payload: MightyWebhookPayload): Promise<{
  email: string;
  memberId: string;
} | null> {
  const p = payload.payload as RawPayload;

  const directEmailCandidates = [
    { email: p.email, id: p.id },
    { email: p.author?.email, id: p.author?.id },
    { email: p.member?.email, id: p.member?.id },
    { email: p.user?.email, id: p.user?.id },
  ];

  for (const c of directEmailCandidates) {
    if (typeof c.email === "string" && c.email.length > 0) {
      return { email: c.email, memberId: String(c.id ?? "") };
    }
  }

  // No email in payload — fall back to a member_id-shaped field and
  // resolve the email via HubSpot's mighty_member_id custom property.
  const memberIdRaw =
    p.creator_id ?? p.member_id ?? p.author_id ?? p.user_id ?? p.member?.id ?? p.author?.id ?? p.id;
  if (memberIdRaw === undefined) return null;

  const memberId = String(memberIdRaw);
  const contact = await findContactByMightyMemberId(memberId);
  const email = contact?.properties?.email as string | undefined;
  if (!email) return null;

  return { email, memberId };
}

function makeEngagementHandler(eventType: EngagementEventType) {
  return async function handle(payload: MightyWebhookPayload): Promise<HandlerResult> {
    const actor = await extractActor(payload);
    if (!actor) {
      return { success: false, message: "missing_actor" };
    }

    const recorded = await recordEngagementEvent({
      mightyMemberId: actor.memberId,
      mightyEmail: actor.email,
      eventType,
      timestamp: payload.event_timestamp,
    });

    const sync = await syncEngagementToHubspot({
      email: actor.email,
      score: recorded.score,
      premierReady: recorded.premierReady,
    });

    const points = ENGAGEMENT_EVENT_POINTS[eventType];
    const messageParts = [
      `+${points} → ${recorded.score}`,
      recorded.thresholdCrossed === "up"
        ? "premier_ready=true"
        : recorded.thresholdCrossed === "down"
          ? "premier_ready=false"
          : null,
      sync.synced ? "synced" : `not_synced(${sync.reason})`,
    ].filter(Boolean);

    return {
      success: true,
      hubspotContactId: sync.hubspotContactId,
      needsReview: !sync.synced,
      reviewReason: sync.synced ? undefined : sync.reason,
      message: messageParts.join(" | "),
    };
  };
}

export const handleMemberCourseProgressStarted = makeEngagementHandler(
  "MemberCourseProgressStarted",
);
export const handleMemberCourseProgressCompleted = makeEngagementHandler(
  "MemberCourseProgressCompleted",
);
export const handlePostCreated = makeEngagementHandler("PostCreated");
export const handleCommentCreated = makeEngagementHandler("CommentCreated");
export const handleRsvpCreated = makeEngagementHandler("RsvpCreated");
export const handleReactionCreated = makeEngagementHandler("ReactionCreated");
