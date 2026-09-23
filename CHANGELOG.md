# LifeStarr Integration Hub — Changelog

Session-level notes on what changed and why. Code-level detail is in
`git log`; this file is the human narrative.

---

## 2026-09-23 — MemberJoined no longer resets plans; Premier reconciliation

- **Fixed MemberJoined relabeling Premier members as Intro** (`d1787c7`). MemberJoined fires once per space, and every fire set `lifestarr_plan=intro`, `lifestarr_plan_status=active`, and lifecycle SQL. So any Premier member who joined a new space was downgraded to Intro in HubSpot, and could fall back into the Premier upsell workflow, which filters on `plan = intro`. Those three writes now happen only when the contact has no plan yet (blank or `none`). Found during a line-by-line code review for the "What It Does" overview doc.
- **Reconciled Premier membership against Mighty's Admin API.** This is the first use of `MIGHTY_API_TOKEN`, which had been sitting unused in `.env.local`. Mighty has 80 Premier members and HubSpot had 76 marked Premier. 4 were correct under a different email and matched only by `mighty_member_id`. 3 were labeled Intro: Claire Gregory and George's host account (both bug victims) and the george+80 test account. All 3 were set to `premier_monthly` with George's approval. HubSpot now matches Mighty on 79 of 80. The remaining one is Joe's Mighty test account, which has no HubSpot contact.
- **Corrections to what we believed:**
  - The dashboard's live/paused toggle is cosmetic. The webhook route never checks it.
  - Failure alert emails fire only when a handler *throws*. A handler that returns a failure is logged as failed with no email.
  - Engagement events for people not in HubSpot never reach the Needs Review queue page.
  - The README's "7 integration cards" is stale; there are 9.

## 2026-05-08 — MemberJoined community-signup fix

- **Fixed initial-signup MemberJoined fires 400ing on `lifestarr_spaces`.** Mighty fires `MemberJoined` once for the community signup itself with `space_id == network_id` (the LifeStarr Central network id `12946344`, not a real space). The handler tried to add it to the `lifestarr_spaces` multi-select and HubSpot rejected with `INVALID_OPTION`. `lib/handlers/member-joined.ts` and `member-left.ts` now skip the multi-select write when `space_id == network_id`, and also when `space_id` isn't in `SPACE_NAMES` (defensive — logs a `console.warn` so a new Mighty space gets noticed). Caught when Stacy Sutton's signup webhook (`fd8c9bb2-3708-446d-8cd8-ea00f6f0100b`) burned through 4 retries and emailed the failure alert 5×. `docs/mighty-setup.md` gotcha #2 updated.

## 2026-05-07 — Dashboard pass + counter cleanup

- **Dashboard surface area expanded** (`0ccf799`): new quick-stats strip at the top of `/dashboard` (members synced, Premier %, Premier-ready count, 24h events), live health badge in the top bar, MemberUpdated and MemberLeft cards added to the Status grid (now 9 cards), and a new Engagement leaderboard at `/dashboard/engagement` showing the top 10 by 30-day score with Premier-ready badges. `lib/health.ts` now powers both `/api/health` and the dashboard badge from a single `getHealthStatus()` helper.
- **Activity feed cleared of test noise** (`1f72cd1`): wrote `scripts/inspect-failures.ts` (read-only categorization) and `scripts/cleanup-test-failures.ts` (dry-run by default, `--apply` to delete). Deleted 32 failed/needs_review events that came from George's testing accounts (`george+*@georgebthomas.com`, `*+george@georgebthomas.com`).
- **Status-grid counters rebuilt** (`eea7edd`): discovered `integrations.failure_count` is a cumulative *historical* counter — deleting events does not decrement it, and retried events double-count. Added `scripts/recalc-integration-counts.ts` that rebuilds `success_count` / `failure_count` per event type by aggregating `webhook_events.status`, with the engagement bundle row summed across the six engagement subtypes. Applied — all failure counters now 0.
- **Engagement scoring documented** (`eea7edd`): new `docs/engagement-scoring.md` covers point values, the 30-day rolling window mechanic, the 50-point Premier-ready threshold, what writes back to HubSpot (`lifestarr_engagement_score`, `lifestarr_premier_ready`), where the data surfaces on the dashboard, and the tuning levers (weights / threshold / window).
