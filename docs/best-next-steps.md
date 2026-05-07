# Best Next Steps — LifeStarr Integration Hub

**Last updated:** 2026-05-07 EOD

The integration is functionally complete and serving real Mighty traffic. Every Mighty event flows into HubSpot, all 442 community members have either been live-synced or backfilled, and the auth-gated dashboard is live. This doc captures **what's worth building next**, organized by where the work lives.

---

## Part 1 — Mighty data we're not yet capturing

What more we could pull from Mighty webhooks (or future Mighty REST API access) into HubSpot. Each item is independent — pick whichever drives the most marketing/CS value.

### Member identity / profile

| What                                                       | Why useful                                                                                                       | Effort                                                                               |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `referrer_email` / `referrer_id` (in MemberJoined payload) | Build a referral graph: who invited who. Power "thank your referrer" flows.                                      | ~30 min — new property `lifestarr_invited_by_email` + handler tweak                  |
| Mighty custom profile question answers                     | LifeStarr's onboarding questionnaire data (per-member). The export's "Profile Question Answers" sheet has these. | ~1 hr — needs per-account question schema decision                                   |
| `last_visited_network` timestamp                           | Drives inactivity-detection ("hasn't logged in in 30 days")                                                      | ~15 min — sync to a new `lifestarr_last_active_at` property                          |
| Sign-in method (Facebook / LinkedIn / Apple / Password)    | Marketing segmentation by acquisition channel                                                                    | ~15 min — single string property                                                     |
| `welcome_checklist_completed` (bool)                       | Onboarding-funnel reporting                                                                                      | ~15 min                                                                              |
| Ambassador level + `members_referred` count                | Identify community evangelists for VIP nurture                                                                   | ✅ already syncing `lifestarr_referral_count`; could add `lifestarr_ambassador_level` |
| `notification_method` / `email_frequency`                  | Honor member preferences when designing email sequences                                                          | ~15 min                                                                              |

### Monetization (when Mighty + Stripe goes live)

| What | Why useful | Effort |
|---|---|---|
| Lifetime revenue (sum of all MemberPurchased + Renewal amounts) | LTV segmentation in HubSpot lists | ~1 hr — running counter via `lifestarr_lifetime_revenue` property |
| `payment_platform` / transaction id from MemberPurchased | Payment-failure triage and reconciliation with Stripe | ~30 min once Stripe is wired in |
| Cancel reason text (from MemberSubscriptionCanceled if Mighty exposes it) | Categorize churn for win-back sequences | ~30 min |
| Subscription paused state | Don't dun a member who's in pause | ~30 min — add `paused` to the `lifestarr_plan_status` enum |
| Days-as-Premier counter | Premier tenure cohort analysis | computed property in HubSpot, no code |

### Engagement (deeper than current)

| What | Why useful | Effort |
|---|---|---|
| Total post / comment / RSVP counts (running) | Find content creators vs lurkers | ~45 min — counters per contact |
| Course completion fully (MemberCourseFullyCompleted if Mighty fires it) | Milestone-based recognition / next-step prompts | ~30 min — register handler |
| Live call attended events (LiveCallAttended) | Strong engagement signal — usually correlates with Premier conversion | ~30 min if Mighty fires this |
| Direct messages sent | Community-pulse metric — high noise, may not be worth it | skip for V1 |
| Solopreneur Connector listings | "Active networker" segment | depends on whether Mighty fires events for listing CRUD |

### Activity recency

| What | Why useful | Effort |
|---|---|---|
| `last_active_date` — most recent of any engagement event | Powers "re-engagement at 14 days inactive" flows | ~15 min — already partly in the engagement DB |
| `most_active_space` — space_id with most events for this member | Track / community affinity beyond just membership | ~1 hr — needs aggregation logic |

---

## Part 2 — HubSpot customizations (workflows, properties, segments)

What LifeStarr can build *on top of* the integration. Most are configuration in HubSpot, no code on our side.

### Workflows (Joe / HubSpot admin)

| Workflow | Trigger | What it does |
|---|---|---|
| **Marketing Contact Toggle** | `lifestarr_central_account_created` is `true` | Set Marketing Contact = Yes (read-only via API; must be done by workflow) |
| **Premier Upsell Sequence** | `lifestarr_premier_ready` becomes `true` AND `lifestarr_plan` is `intro` | Email sequence + sales notification |
| **Welcome Series** | New contact with `mighty_match_status = new_contact_unverified` | First-week onboarding emails referencing their `lifestarr_track` |
| **Win-Back Campaign** | `lifestarr_plan_status` becomes `canceled` | 30/60/90 day re-engagement emails |
| **Re-Engagement (low score)** | `lifestarr_engagement_score` < 10 AND `lifestarr_central_account_created` is `true` for 14+ days | "We miss you" check-in |
| **Premier Welcome** | `lifestarr_plan` becomes `premier_monthly` or `premier_annual` | Premier onboarding sequence + community spotlight |
| **Track-specific nurture** | `lifestarr_track` set to specific value | Foundation/Growth/Reset-specific email content |
| **Missing Profile Bio** | `lifestarr_profile_bio` is empty after 7 days | Friendly nudge to complete profile |

### New custom contact properties to add (you choose which)

| Property | Type | Source / formula |
|---|---|---|
| `lifestarr_lifetime_revenue` | number | Running counter from MemberPurchased + Renewed amounts |
| `lifestarr_last_active_date` | date | Most recent of any engagement event |
| `lifestarr_days_as_premier` | number | HubSpot calculated: today − `lifestarr_premier_start_date` |
| `lifestarr_total_posts` / `_comments` / `_rsvps` | number | Running counters |
| `lifestarr_invited_by_email` | string | From MemberJoined payload |
| `lifestarr_first_purchase_date` | date | Distinct from current premier_start_date — survives plan changes |
| `lifestarr_churn_risk_score` | number | Composite: engagement trend + days_inactive (custom calc) |

### Segmentation lists (HubSpot lists, no code)

These all become trivial once the data is in place:

- **Active Premier members** — `lifestarr_plan_status = active` AND `lifestarr_plan in (premier_monthly, premier_annual)`
- **Premier-ready Intro members** — `lifestarr_premier_ready = true` AND `lifestarr_plan = intro`
- **High-engagement Intros** — `lifestarr_engagement_score >= 30` AND `lifestarr_plan = intro`
- **At-risk Premier (low engagement)** — Premier plan AND `lifestarr_engagement_score < 10`
- **Foundation track members** — `lifestarr_track = foundation`
- **Members in Growth Blueprint Community** — `lifestarr_spaces` contains `20821660`
- **Recently joined a course space** — `lifestarr_last_space_joined_at` in last 7 days
- **Power users** — `lifestarr_space_membership_count > 10`
- **Inactive 30+ days** — `lifestarr_last_active_date` older than 30 days
- **Profile incomplete** — `lifestarr_profile_bio` is empty AND joined > 7 days ago

---

## Part 3 — Reports / dashboards to build (in HubSpot)

What HubSpot custom reports/dashboards would surface real value once data is flowing. These are HubSpot Reporting features, no integration code needed.

### Acquisition / growth

- **New member growth rate** — count of new contacts per week with `mighty_match_status = new_contact_unverified` (i.e. our integration created them, meaning they're net-new from Mighty)
- **Sign-up funnel** — Mighty MemberJoined → contact in HubSpot → first content engagement → Premier-ready
- **Acquisition channel breakdown** — how many community members came from each source (`hs_latest_source` is auto-set)

### Conversion

- **Intro → Premier conversion rate** — percentage of Intro contacts that have a `lifestarr_premier_start_date` set
- **Time-to-Premier** — days between `lifestarr_central_intro_account_created_date` and `lifestarr_premier_start_date` (cohort by month)
- **Premier-ready conversion rate** — what % of contacts who hit the threshold actually upgrade

### Retention

- **Premier renewal rate** — percentage of Premier members with active plan vs canceled in the last 30 / 60 / 90 days
- **Engagement score distribution** — histogram by `lifestarr_track` (are Foundation members more engaged than Growth?)
- **Inactivity heatmap** — count of members in each `lifestarr_engagement_score` bucket (0, 1-10, 11-30, 31-50, 50+)

### Community health

- **Space membership leaderboard** — average space count per member, top spaces by membership
- **Track distribution** — pie chart of active members by `lifestarr_track`
- **Top contributors** — leaderboard by total posts/comments (once those counters are added)
- **Weekly active members** — distinct contacts with engagement events in the last 7 days

### Operational (for the integration itself)

- **Webhook health** — count of `webhook_events.status = success` vs `failed` over time. Already visible in `/dashboard/activity`; could surface as a HubSpot custom property if you want a snapshot in HubSpot too.
- **Needs-review queue size** — count of unresolved `needs_review_queue` rows. Trend should be flat or decreasing.

---

## Recommended order if you want a punch list

1. **Joe builds the Premier Upsell workflow** (already on his plate per the audit)
2. **Joe builds the Marketing Contact toggle workflow** (unblocks marketing emails to community members)
3. **George + Joe define the Welcome workflow** (segment by `lifestarr_track`)
4. **Joe builds 5 segmentation lists** from Part 2 — instant value, takes ~30 min each
5. **George**: add 2-3 new properties from Part 2 (recommend `lifestarr_lifetime_revenue`, `lifestarr_last_active_date`, `lifestarr_total_posts`)
6. **Joe builds the Premier conversion + retention reports** in HubSpot
7. **Then revisit AI Integration** if useful patterns emerge from the reports

Total realistic effort to ship items 1-4: **a few hours of Joe's time** with no code changes from George. Items 5-6 add maybe a half day of code + HubSpot work.
