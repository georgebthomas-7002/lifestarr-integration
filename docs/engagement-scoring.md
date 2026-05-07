# Engagement Scoring & Premier-Ready

**Last updated:** 2026-05-07

How LifeStarr's engagement score is calculated, when a member becomes "Premier-ready," and what writes back to HubSpot.

---

## TL;DR

- Six Mighty webhook events award points: course progress, posts, comments, RSVPs, reactions.
- Each member has a **rolling 30-day score** stored in Postgres (`engagement_scores` table).
- Crossing **score ≥ 50** flips `lifestarr_premier_ready = true` on the HubSpot contact. Falling below flips it back.
- HubSpot also gets the raw score in `lifestarr_engagement_score` so you can build lists, lifecycle stages, and workflows on top.

---

## Point values

Source: [`lib/engagement.ts`](../lib/engagement.ts) → `ENGAGEMENT_EVENT_POINTS`

| Mighty event | Points | Why this weight |
|---|---:|---|
| `MemberCourseProgressCompleted` | **20** | Strongest signal — completed a course module. Maps best to Premier upsell intent. |
| `PostCreated` | **10** | Member-authored content; a real act of contribution. |
| `RsvpCreated` | **8** | Committed time to a live event. Higher than a comment, lower than a post. |
| `MemberCourseProgressStarted` | **5** | Started a course but hasn't finished. Light signal. |
| `CommentCreated` | **5** | Participating in someone else's thread. |
| `ReactionCreated` | **1** | Cheap signal — a single emoji react. Many of these add up. |

These are tunable. Change the values in `ENGAGEMENT_EVENT_POINTS` and the next event re-derives every score from each member's stored event history.

---

## Rolling 30-day window

Constants in `lib/engagement.ts`:
- `ROLLING_WINDOW_DAYS = 30`
- `ENGAGEMENT_THRESHOLD = 50`

On each engagement webhook, the handler:

1. Loads the member's row from `engagement_scores` (keyed by Mighty email).
2. **Prunes** any events in `recent_events` older than 30 days.
3. Appends the new event with its point value and timestamp.
4. Recomputes `score = SUM(points)` over the surviving events.
5. Persists the row + new score.

So the score is always a sum of *the member's last 30 days of engagement* — older activity ages out automatically without a cron job.

---

## Premier-ready threshold

```
isReady   = score >= 50   (current event)
wasReady  = previousScore >= 50
crossed   = "up"   if !wasReady && isReady
            "down" if  wasReady && !isReady
            null   otherwise
```

Whenever `isReady` changes value, the handler updates HubSpot. Falling below the threshold *does* flip `lifestarr_premier_ready` back to `false` — this is intentional so the property stays a live indicator, not a sticky flag.

---

## What lands in HubSpot

Every engagement webhook calls `syncEngagementToHubspot()`, which writes two contact properties (group: `lifestarr`):

| HubSpot property | Type | Source |
|---|---|---|
| `lifestarr_engagement_score` | number | The raw rolling-30 score |
| `lifestarr_premier_ready` | boolean | `score >= 50` |

It also stamps `engagement_scores.last_synced_to_hubspot_at` so we can spot drift if a sync ever fails silently.

If the contact can't be matched in HubSpot (e.g. brand-new email not yet in the CRM), the handler returns `needsReview` with reason `no_hubspot_match`. The webhook still gets a successful 200 ack to Mighty — the unsynced row just queues for manual review on `/dashboard/review`.

---

## Where the dashboard surfaces this

- **Top quick-stats strip** (`/dashboard`) — "Premier-ready" tile counts contacts with `lifestarr_premier_ready = true` in HubSpot.
- **Engagement leaderboard** (`/dashboard/engagement`) — top 10 members by score from the local `engagement_scores` table, with a Premier-ready badge above the threshold and the gap to threshold below.
- **Status grid card** (`/dashboard`) — `engagement_bundle` row aggregates success/failure across all six engagement event types.

---

## Tuning levers

If George wants to recalibrate without touching the code:
- **Change weights** → edit `ENGAGEMENT_EVENT_POINTS`. Existing scores will rebalance on the next event per member.
- **Change threshold** → edit `ENGAGEMENT_THRESHOLD`.
- **Change window** → edit `ROLLING_WINDOW_DAYS`. Note: this only changes which events get *pruned* — historical events older than the new window stop counting on the next webhook.

There's no automatic recompute job — scores re-derive themselves naturally as members keep engaging. To force-rebalance every member after changing the constants, write a one-off script that loads each `engagement_scores` row and re-applies the prune + sum logic.

---

## Files involved

| File | Role |
|---|---|
| `lib/engagement.ts` | Point values, threshold, `recordEngagementEvent`, `syncEngagementToHubspot` |
| `lib/handlers/engagement.ts` | The 6 webhook handlers — each one calls `recordEngagementEvent` then `syncEngagementToHubspot` |
| `lib/db/schema.ts` | `engagement_scores` table definition |
| `lib/integrations-config.ts` | `ENGAGEMENT_BUNDLE_EVENT_TYPE` synthetic key for the dashboard card |
| `lib/hubspot-properties.ts` | `lifestarr_engagement_score`, `lifestarr_premier_ready` property definitions |
| `app/dashboard/engagement/page.tsx` | Leaderboard view |
