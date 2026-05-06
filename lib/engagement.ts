import { eq } from "drizzle-orm";

import { db, engagementScores } from "@/lib/db";
import type { RecentEvent } from "@/lib/db";
import { findContactByEmail, updateContactProperties } from "@/lib/hubspot-client";

/**
 * Per-event point values. Tunable. Tier 1 milestones (course completion) score
 * highest because they correlate strongest with the kind of deeper engagement
 * that maps to a Premier upsell.
 */
export const ENGAGEMENT_EVENT_POINTS = {
  MemberCourseProgressStarted: 5,
  MemberCourseProgressCompleted: 20,
  PostCreated: 10,
  CommentCreated: 5,
  RsvpCreated: 8,
  ReactionCreated: 1,
} as const;

export type EngagementEventType = keyof typeof ENGAGEMENT_EVENT_POINTS;

export const ENGAGEMENT_THRESHOLD = 50;
export const ROLLING_WINDOW_DAYS = 30;

const ROLLING_WINDOW_MS = ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export type ThresholdCrossing = "up" | "down" | null;

export type RecordEngagementInput = {
  mightyMemberId: string;
  mightyEmail: string;
  eventType: EngagementEventType;
  timestamp?: string;
};

export type RecordEngagementResult = {
  score: number;
  previousScore: number;
  thresholdCrossed: ThresholdCrossing;
  premierReady: boolean;
};

export async function recordEngagementEvent(
  input: RecordEngagementInput,
): Promise<RecordEngagementResult> {
  const points = ENGAGEMENT_EVENT_POINTS[input.eventType];
  const ts = input.timestamp ?? new Date().toISOString();
  const cutoff = Date.now() - ROLLING_WINDOW_MS;

  const existing = await db
    .select()
    .from(engagementScores)
    .where(eq(engagementScores.mightyEmail, input.mightyEmail))
    .limit(1);

  let previousScore: number;
  let pruned: RecentEvent[];

  if (existing[0]) {
    previousScore = existing[0].score;
    pruned = (existing[0].recentEvents ?? []).filter(
      (e) => new Date(e.timestamp).getTime() >= cutoff,
    );
  } else {
    previousScore = 0;
    pruned = [];
  }

  pruned.push({ eventType: input.eventType, timestamp: ts, points });
  const score = pruned.reduce((sum, e) => sum + e.points, 0);

  if (existing[0]) {
    await db
      .update(engagementScores)
      .set({
        score,
        recentEvents: pruned,
        mightyMemberId: input.mightyMemberId,
        lastCalculatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(engagementScores.id, existing[0].id));
  } else {
    await db.insert(engagementScores).values({
      mightyMemberId: input.mightyMemberId,
      mightyEmail: input.mightyEmail,
      score,
      recentEvents: pruned,
    });
  }

  const wasReady = previousScore >= ENGAGEMENT_THRESHOLD;
  const isReady = score >= ENGAGEMENT_THRESHOLD;
  const thresholdCrossed: ThresholdCrossing =
    !wasReady && isReady ? "up" : wasReady && !isReady ? "down" : null;

  return { score, previousScore, thresholdCrossed, premierReady: isReady };
}

export type SyncEngagementResult = {
  synced: boolean;
  hubspotContactId?: string;
  reason?: string;
};

export async function syncEngagementToHubspot(opts: {
  email: string;
  score: number;
  premierReady: boolean;
}): Promise<SyncEngagementResult> {
  const contact = await findContactByEmail(opts.email);
  if (!contact) {
    return { synced: false, reason: "no_hubspot_match" };
  }

  await updateContactProperties(contact.id, {
    lifestarr_engagement_score: opts.score,
    lifestarr_premier_ready: opts.premierReady,
  });

  await db
    .update(engagementScores)
    .set({ lastSyncedToHubspotAt: new Date() })
    .where(eq(engagementScores.mightyEmail, opts.email));

  return { synced: true, hubspotContactId: contact.id };
}
