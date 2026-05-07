# Mighty Networks Webhook Setup

Configuring Mighty to send events to LifeStarr Integration Hub. Done once per environment (production deploy).

> **Status update (2026-05-07):** This webhook is configured and live in production. Below are the actual gotchas we hit during cutover, preserved for anyone setting up a second environment.

## Real-world gotchas discovered during setup (read these first)

1. **Mighty's event names end in `Hook`** — the webhook payload has `event_type: "MemberJoinedHook"`, `"MemberPurchasedHook"`, `"MemberUpdatedHook"`, etc. — not the clean names Mighty's docs imply. Our `lib/router.ts` `normalizeEventType()` strips the suffix transparently, so handlers register under the clean name (`MemberJoined`).

2. **Mighty fires `MemberJoined` per-space** — when a member joins a community OR is added to any Space within it, Mighty fires `MemberJoinedHook` with that `space_id` in the top-level payload. So a single new member can fire 20+ MemberJoined events in a burst. Same for `MemberLeftHook` when they leave a space. We treat each fire as idempotent and use it to populate `lifestarr_spaces`.

3. **Bearer token field is auto-prefixed by Mighty.** Type the raw secret (no `Bearer ` prefix) into Mighty's "API Key" field. If you type `Bearer xxxxx`, Mighty wraps it as `Bearer Bearer xxxxx` and our verifier 401-rejects every event silently.

4. **Mighty's "API Key" field accepts the URL with double slashes.** The default-prefilled URL in our screenshot was `https://lifestarr-integration.vercel.app//api/webhook` — fix to single slash before saving.

5. **MemberJoined payload variants:**
   - `MemberJoined` / `MemberUpdated` / `MemberLeft`: nested under `payload.member`
   - `MemberPurchased`: flat with `member_*` prefix (no `member` wrapper)
   - `MemberRemovedFromPlan`: third shape — flat at top level, no prefix
   - `PostCreated` / `CommentCreated`: only have `creator_id`, no email at all
   - Our `lib/handler-utils.ts extractMember()` handles all four shapes; if Mighty introduces a fifth, that's where to add it.

6. **Mighty's Premier plan currently has `type: "free"` and `amount: 0`** because LifeStarr is hand-granting Premier as they collect payment in HubSpot. Our `mapMightyPlan()` prioritizes name keywords over `plan.type` for this reason — when Mighty/Stripe goes live and `type` becomes `paid`, the same code keeps working.

7. **Bio updates fire `PostCreated`** — Mighty stores the member bio as an "About Me" post in the community, so editing the bio fires `MemberUpdated` AND `PostCreated`. We score the post (+10 engagement) which can be overzealous; tune in `lib/engagement.ts` if needed.

## Prerequisites

- Mighty Networks community on a plan that supports webhooks (Mighty Pro / Business as of 2026)
- Mighty Admin access
- A deployed instance of LifeStarr Integration Hub (production URL on Vercel)
- The `MIGHTY_WEBHOOK_SECRET` value already set in the deployed app's env vars

## 1. Generate / confirm the webhook secret

If you haven't already, generate one:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save it as `MIGHTY_WEBHOOK_SECRET` in:
- `.env.local` (locally)
- Vercel project env vars for **all three** environments (production / preview / development)

The deployed app rejects any inbound webhook that doesn't carry this exact value as a bearer token.

## 2. Configure the webhook in Mighty

> Mighty's admin UI evolves — these steps are accurate as of 2026-05. If anything has moved, the underlying concept is the same: send events to an authenticated URL.

1. Log into Mighty Networks as an admin
2. Go to your community → **Settings** (or **Admin Dashboard**)
3. Find **Integrations** → **Webhooks** (sometimes nested under **Developer** or **API**)
4. Click **Add Webhook** / **New Webhook**

### Webhook configuration

- **URL**: `https://<your-vercel-domain>/api/webhook`
  - Example: `https://lifestarr-integration.vercel.app/api/webhook`
- **HTTP method**: `POST`
- **Authentication header**:
  - **Header name**: `Authorization`
  - **Header value**: `Bearer <your-MIGHTY_WEBHOOK_SECRET>` (literally include the word `Bearer ` then the secret)
- **Content type**: `application/json`

### Events to subscribe to

Select all of these events. They map 1:1 to handlers in the Hub.

**Tier 1 — Lifecycle / monetization**

- Member Joined
- Member Purchased
- Member Plan Changed
- Member Subscription Canceled
- Member Subscription Renewed
- Member Removed From Plan

**Tier 2 — Engagement signals**

- Member Course Progress Started
- Member Course Progress Completed
- Post Created
- Comment Created
- RSVP Created
- Reaction Created

If Mighty's UI uses different event labels than what's listed above, send a test for each candidate and look at the resulting `event_type` value in the Activity dashboard or `webhook_events.event_type` column. If a name is different, update the handler registry in `lib/handlers/index.ts` to map the new name to the existing handler.

### Save

Save the webhook. Mighty typically lets you fire a test event from this screen — do it now.

## 3. Verify

In the Hub dashboard at `/dashboard/activity`, you should see the test event arrive within a few seconds. Status should be `success` (or `needs_review` if the test member doesn't have a HubSpot match — that's expected for synthetic test data).

If you see `unauthorized` (401) or no event at all:
- Confirm the **Authorization** header value is exactly `Bearer <secret>` with the word `Bearer ` and a space
- Confirm `MIGHTY_WEBHOOK_SECRET` in Vercel matches what you pasted into Mighty (no extra whitespace, no quotes)
- Check Vercel's runtime logs for the `/api/webhook` function

## 4. Operational notes

- **Idempotency** is automatic — Mighty's `event_id` is the primary key for de-dup. If Mighty retries an event, the Hub will short-circuit on the second attempt with `status: "already_processed"`.
- **Out-of-order events** are tolerated for property updates (the latest write wins) but can produce odd state if a `MemberSubscriptionRenewed` arrives before the original `MemberPurchased`. In practice Mighty delivers events in order; if you see anomalies, check the Activity feed.
- **Failed events** are visible in the dashboard's Activity feed and can be manually retried via the **Retry** button. If you've configured `ALERT_EMAIL`, you'll also get an email per permanent failure.
- **Pause an integration**: in the dashboard's Status grid, toggle a card to **Paused**. (Note: as of V1, this updates the integrations table for visibility; the webhook receiver does not yet hard-skip dispatch on paused — a 1-line addition if needed. Tell George.)

## 5. When something looks wrong

1. Check **Activity** at `/dashboard/activity` — most issues surface there with an `error_message`
2. Check **Needs Review** at `/dashboard/review` — unmatched contacts queue up here for manual reconciliation in HubSpot
3. Check Vercel runtime logs (`vercel logs --prod` or in the Vercel dashboard) for stack traces
4. As a last resort: replay individual events via the dashboard or, programmatically:

```ts
import { replayWebhook } from "@/lib/replay-webhook";
await replayWebhook("<webhook-event-uuid>");
```
