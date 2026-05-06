import {
  ENGAGEMENT_EVENT_POINTS,
  recordEngagementEvent,
  syncEngagementToHubspot,
  type EngagementEventType,
} from "@/lib/engagement";
import type { HandlerResult, MightyWebhookPayload } from "@/lib/types";

/**
 * Engagement payloads in Mighty have inconsistent shapes:
 *   - direct member events (course progress, RSVP) → `payload.email`, `payload.id`
 *   - content events (post, comment, reaction)       → `payload.author.email`, `payload.author.id`
 *   - some include `member.email` / `user.email`
 *
 * We probe a small set of likely locations.
 */
type RawPayload = Record<string, unknown> & {
  id?: string | number;
  email?: string;
  author?: { id?: string | number; email?: string };
  member?: { id?: string | number; email?: string };
  user?: { id?: string | number; email?: string };
};

function extractActor(payload: MightyWebhookPayload): {
  email: string;
  memberId: string;
} | null {
  const p = payload.payload as RawPayload;
  const candidates = [
    { email: p.email, id: p.id },
    { email: p.author?.email, id: p.author?.id },
    { email: p.member?.email, id: p.member?.id },
    { email: p.user?.email, id: p.user?.id },
  ];

  for (const c of candidates) {
    if (typeof c.email === "string" && c.email.length > 0) {
      return { email: c.email, memberId: String(c.id ?? "") };
    }
  }
  return null;
}

function makeEngagementHandler(eventType: EngagementEventType) {
  return async function handle(payload: MightyWebhookPayload): Promise<HandlerResult> {
    const actor = extractActor(payload);
    if (!actor) {
      return { success: false, message: "missing_actor_email" };
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
