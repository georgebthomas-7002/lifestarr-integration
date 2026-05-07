# Mighty Networks Webhook Setup

Configuring Mighty to send events to LifeStarr Integration Hub. Done once per environment (production deploy).

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
