# Go-Live Runbook (Phase 9)

Cutting LifeStarr Integration Hub over from local dev to a real Mighty Networks webhook stream.

Owner: George Thomas (Sidekick) + Joe (LifeStarr).

## Pre-flight checklist

Before pointing Mighty at production, verify each item below. Any "no" → fix before proceeding.

### 1. Production deploy is green

- [ ] Latest commit on `main` shows ✅ in the Vercel dashboard
- [ ] `https://lifestarr-integration.vercel.app` loads (will redirect to `/login`)
- [ ] `https://lifestarr-integration.vercel.app/api/health` returns `200` with `status: "healthy"` and all env-var checks `"ok"`

If health endpoint returns `degraded`, look at which check is `missing` and add that env var to Vercel:

```bash
vercel env add <NAME> production preview development
```

### 2. Database is migrated and seeded

- [ ] `npm run db:migrate` from local with production env shows "no pending migrations"
- [ ] `/dashboard/activity` (after sign-in) shows a webhook_events row from the local smoke tests

### 3. HubSpot is set up

- [ ] HubSpot Private App token is in Vercel env (`HUBSPOT_API_TOKEN`)
- [ ] `npm run setup:hubspot` reports "9 contact properties verified"
- [ ] `lifestarr` property group is visible on any HubSpot contact
- [ ] Pipeline + stage IDs in env match a real pipeline (`HUBSPOT_CUSTOMER_PIPELINE_ID`, `HUBSPOT_NEW_PURCHASE_STAGE_ID`)

### 4. Auth is functional

- [ ] `ALLOWED_EMAILS` in Vercel env contains every operator's email (George, Joe, anyone else who needs the dashboard)
- [ ] `AUTH_RESEND_KEY` is set
- [ ] `AUTH_URL` matches the production URL (`https://lifestarr-integration.vercel.app`)
- [ ] `RESEND_FROM_EMAIL` is set
  - Sandbox (current): `onboarding@resend.dev` — only the Resend account owner's email receives magic links
  - Production: `noreply@lifestarr.com` (or similar) once Joe's domain is verified
- [ ] You can sign in to the dashboard from the deployed URL

### 5. Sandbox-mode caveat

While `RESEND_FROM_EMAIL=onboarding@resend.dev`, magic-link emails ONLY land in the inbox of the email address verified on the Resend account. To unblock the full team, switch to a verified-domain sender (see `docs/hubspot-setup.md` reference at the bottom).

## Cutover steps

### Step A: Add the Mighty webhook

Joe (or George with admin access) follows [docs/mighty-setup.md](mighty-setup.md):

- URL: `https://lifestarr-integration.vercel.app/api/webhook`
- Auth: `Authorization: Bearer <MIGHTY_WEBHOOK_SECRET>`
- Subscribe to all 12 event types

### Step B: Fire a controlled test event

If Mighty's UI offers "send test event" → use it. Watch for the event to appear at `/dashboard/activity` within ~5 seconds.

If no test-event UI:

1. Have George trigger a real low-stakes event (e.g. RSVP to a community post on a test account)
2. Watch `/dashboard/activity` — the event should land within seconds
3. Click into the event row, confirm `status = success` (or `needs_review` if the test member doesn't have a HubSpot record)

### Step C: Verify HubSpot reflects reality

- Pick a known active LifeStarr member's email
- In HubSpot, find their contact record
- Have George or Joe trigger a real event for that member (e.g. join a course)
- Within seconds, the contact's LifeStarr property group should update (`lifestarr_engagement_score` ticks up, etc.)

### Step D: Hand off to Joe

Walk Joe through:

- The Status grid (live/paused per integration)
- The Activity feed (event-by-event audit trail)
- The Needs Review queue (action items for unmatched contacts)
- The Settings page (env reference)

Confirm Joe has dashboard access (allowlisted email + can sign in).

Build the HubSpot upsell workflow keyed off `lifestarr_premier_ready = true` if not already done — see `docs/hubspot-setup.md` § 5.

## What to monitor in the first 24 hours

- **`/dashboard/activity`** — watch for any `failed` rows. Click in, read `error_message`, retry.
- **`ALERT_EMAIL` inbox** — failure alerts arrive here.
- **Vercel runtime logs** — `vercel logs --prod` if you want to tail.
- **`/dashboard/review`** — unresolved entries indicate Mighty members who don't exist in HubSpot. Joe should reconcile manually.

## Rollback

If something goes badly wrong:

1. **Disable the Mighty webhook** in Mighty's admin (the fastest stop)
2. (Optional) Revert the offending commit:
   ```bash
   git revert <bad-commit-sha>
   git push
   ```
3. Vercel auto-deploys the revert within ~2 minutes

The webhook receiver is idempotent (de-dup on `event_id`), so if Mighty replays events when re-enabled later, no double-processing.

## Post-launch follow-ups

- Switch `RESEND_FROM_EMAIL` from sandbox to verified domain once Joe completes DNS verification (one env var change + redeploy)
- Decide: should paused integrations actually skip dispatch? (Currently they update the integrations table for visibility but the receiver still calls handlers.) 1-line addition if yes.
- Set up uptime monitoring on `/api/health` (UptimeRobot, Vercel monitoring, Better Uptime — anything that pings every 5 min)
- Consider Vercel Log Drains to forward logs into a long-term store if compliance requires it
