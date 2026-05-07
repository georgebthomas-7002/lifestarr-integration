# LifeStarr Integration — HubSpot Property Mapping Audit

**Audit date:** 2026-05-07
**Scope:** What our integration sets in HubSpot today, how plan levels are detected, all Mighty Networks webhook data we could capture, and recommended new custom properties.

---

## Part 1 — What our integration sets in HubSpot TODAY

### A. On every contact CREATE (write-once, never on update)

These are baked into `lib/hubspot-client.ts` `buildCreateOnlyProps()` so any handler that creates a new HubSpot contact gets them automatically:

| HubSpot property | Value set | Why "create only" |
|---|---|---|
| `hubspot_owner_id` | Joe Rando (`31326837`, env `HUBSPOT_DEFAULT_CONTACT_OWNER_ID`) | Don't reassign existing contacts that already have an owner. |
| `hs_latest_source` | `INTEGRATION` | Don't clobber organic/paid attribution on existing contacts. |
| `hs_latest_source_data_2` | `LifeStarr Integration` | Same. |
| `hs_object_source_detail_1` | `LifeStarr Integration` | Same. Was showing "Zapier" previously. |
| `hs_marketable_status` | `MARKETING_CONTACT` | Flag new contacts as Marketing Contacts in HubSpot Marketing Hub. |

⚠️ **`hs_marketable_status` setting needs verification.** Some HubSpot accounts treat this property as read-only and require the dedicated Marketing Contacts API endpoint. If after the next test the new contact is NOT showing as a Marketing Contact, we'll switch to `client.marketing.marketingContactsBulkApi.create({...})` after the contact is created. Easy 5-line follow-up.

### B. By event handler

| Event | Properties set | Notes |
|---|---|---|
| **MemberJoined** | `email`, `firstname`, `lastname`, `mighty_member_id`, `lifestarr_plan = intro`, `lifestarr_plan_status = active`, `lifestarr_central_intro_account_created_date`, `lifestarr_central_account_created = true`, `mighty_match_status`, `lifecyclestage = salesqualifiedlead` (separate update with try/catch so HubSpot's "no backward transition" rule doesn't break the handler) | For NEW contacts also gets all the create-only props from §A. For existing contacts, HubSpot owner / source attribution preserved. |
| **MemberUpdated** | `firstname`, `lastname`, `mighty_member_id` only | Light-touch identity sync. Doesn't touch lifecycle, plan, owner, or source attribution — those belong to lifecycle/monetization handlers and shouldn't re-stamp on every profile edit. |
| **MemberPurchased** | All the above on a created contact, plus a HubSpot **deal** in the Customer Pipeline at the Closed-won stage. Sets `lifestarr_plan` (mapped from Mighty plan_name), `lifestarr_plan_status = active`, `lifestarr_premier_start_date` if it's a Premier plan. | The plan-level detection (intro vs premier monthly vs premier annual) lives in `lib/handler-utils.ts mapMightyPlan()`. |
| **MemberPlanChanged** | Updates `lifestarr_plan` (re-mapped), `lifestarr_plan_status = active` | No deal created (this is a plan switch, not a new purchase). |
| **MemberSubscriptionCanceled** | `lifestarr_plan_status = canceled` | Does NOT change `lifestarr_plan` — keep the plan name so HubSpot lists can show "Canceled Premier Monthly" etc. |
| **MemberSubscriptionRenewed** | `lifestarr_premier_renewal_date`, `lifestarr_plan_status = active` | Logs renewal; status forced back to active in case it was past_due. |
| **MemberRemovedFromPlan** | `lifestarr_plan = none`, `lifestarr_plan_status = removed` | Member was kicked or left the paid tier entirely. |
| **6 engagement events** (CourseProgressStarted/Completed, PostCreated, CommentCreated, RsvpCreated, ReactionCreated) | `lifestarr_engagement_score` + `lifestarr_premier_ready` (both updated when threshold crosses 50) | Rolling 30-day score in `lib/engagement.ts`. |

### C. The full LifeStarr custom-property set in HubSpot

11 custom properties live in the `lifestarr` property group:

| Property | Type | Set by |
|---|---|---|
| `mighty_member_id` | string | every member event |
| `mighty_match_status` | enum (matched / new_contact_unverified / duplicate_review_needed) | every member event |
| `lifestarr_plan` | enum (intro / premier_monthly / premier_annual / none) | join, purchase, plan-changed, removed |
| `lifestarr_plan_status` | enum (active / canceled / removed / past_due) | join, purchase, cancel, renewal, removed |
| `lifestarr_central_intro_account_created_date` | date | MemberJoined |
| `lifestarr_central_account_created` | bool | MemberJoined |
| `lifestarr_premier_start_date` | date | MemberPurchased (when plan = premier_*) |
| `lifestarr_premier_renewal_date` | date | MemberSubscriptionRenewed |
| `lifestarr_engagement_score` | number | engagement events |
| `lifestarr_premier_ready` | bool | engagement events (flips at score ≥ 50) |
| `lifestarr_track` | enum (foundation / growth / reset / unassigned) | NOT YET SET — defined but no handler writes to it |

---

## Part 2 — Plan-level detection (Intro vs Premier)

**Yes, the system distinguishes plan levels.** The mapping logic lives in one helper used by every monetization handler:

```ts
// lib/handler-utils.ts
export function mapMightyPlan(plan: { plan_name?: string; interval?: string }): LifestarrPlan {
  const name = (plan.plan_name ?? "").toLowerCase();
  const interval = (plan.interval ?? "").toLowerCase();
  if (name.includes("intro")) return "intro";
  if (name.includes("annual") || interval === "annual" || interval === "yearly") return "premier_annual";
  if (name.includes("premier") || interval === "monthly") return "premier_monthly";
  return "none";
}
```

Plan flow it produces:

| Mighty payload | LifeStarr plan tag |
|---|---|
| MemberJoined (no plan info) | `intro` (hardcoded — joining = free tier) |
| MemberPurchased with plan_name containing "intro" | `intro` |
| plan_name with "annual" / interval = "annual" or "yearly" | `premier_annual` |
| plan_name with "premier" or interval = "monthly" | `premier_monthly` |
| Anything else | `none` |

**Action item:** verify this matches your actual plan names in Mighty. If Mighty's plan names are like "LifeStarr Premier Monthly Plan" the heuristic works. If they're like "LifeStarr Pro" or "Founders Tier", we'd need to update the keyword check or switch to plan_id-based mapping.

To verify: when the next real `MemberPurchased` event lands, check `webhook_events.payload->>plan_name` and confirm the resulting `lifestarr_plan` value on the HubSpot contact.

---

## Part 3 — Mighty Networks data we could capture (full event catalog)

### Tier-1: Member lifecycle (currently fully wired)

| Mighty event | Payload typically includes | Wired? |
|---|---|---|
| `MemberJoinedHook` | `id`, `email`, `first_name`, `last_name`, `joined_at`, `profile_image_url`, `bio`, `location`, `timezone`, `referral_source`, `custom_profile_fields` | ✅ basic identity. **Many fields not captured today** — see Part 4. |
| `MemberUpdatedHook` | All MemberJoined fields | ✅ light-touch; just name + member_id. |
| `MemberLeftHook` / `MemberRemovedHook` | `id`, `email`, `removed_at`, `reason` | ❌ no handler. Worth adding — would set lifestarr_plan_status to "removed" and lifecyclestage back to "lead" or similar. |
| `MemberInvitedHook` | `id`, `inviter_id`, `email`, `invited_at` | ❌ no handler. Would let us track who invited whom — referral attribution. |

### Tier-1: Monetization (currently fully wired)

| Mighty event | Payload typically includes | Wired? |
|---|---|---|
| `MemberPurchasedHook` | `id`, `email`, `plan_id`, `plan_name`, `amount`, `currency`, `interval`, `purchased_at`, `transaction_id`, `payment_method` | ✅ creates deal + sets plan. **`transaction_id`, `payment_method` not captured.** |
| `MemberPlanChangedHook` | `id`, `email`, `old_plan_id`, `new_plan_id`, `changed_at`, `reason` (upgrade/downgrade) | ✅ updates plan. **Old plan + reason not captured.** |
| `MemberSubscriptionRenewedHook` | `id`, `email`, `plan_id`, `renewed_at`, `next_renewal_at`, `amount` | ✅ logs renewal. **`next_renewal_at`, renewal amount not captured.** |
| `MemberSubscriptionCanceledHook` | `id`, `email`, `canceled_at`, `effective_at`, `reason` | ✅ marks canceled. **Cancellation reason + effective date not captured.** |
| `MemberSubscriptionPausedHook` | `id`, `email`, `paused_at`, `resume_at` | ❌ no handler. Mighty supports pausing — we'd want a `paused` plan status. |
| `MemberSubscriptionExpiredHook` | `id`, `email`, `expired_at` (failed renewal) | ❌ no handler. This is the dunning/past-due path — important. |
| `MemberRemovedFromPlanHook` | `id`, `email`, `removed_at`, `reason` | ✅ marks removed. |

### Tier-2: Engagement (currently fully wired for scoring)

| Mighty event | Payload typically includes | Wired? |
|---|---|---|
| `MemberCourseProgressStartedHook` | `id`, `email`, `course_id`, `course_name`, `lesson_id`, `started_at` | ✅ scoring only. **course_name etc. not captured.** |
| `MemberCourseProgressCompletedHook` | `id`, `email`, `course_id`, `course_name`, `lesson_id`, `completed_at` | ✅ scoring only. |
| `MemberCourseSectionCompletedHook` (if it exists) | section_id, section_name | ❌ would give finer-grained completion tracking. |
| `MemberCourseFullyCompletedHook` (if it exists) | course_id, completed_at | ❌ — this is a HubSpot-worthy milestone (badge, kudos email). |
| `PostCreatedHook` | `author.{id, email}`, `post_id`, `space_id`, `title`, `body`, `created_at` | ✅ scoring only. |
| `CommentCreatedHook` | `author.{id, email}`, `comment_id`, `post_id`, `body`, `created_at` | ✅ scoring only. |
| `ReactionCreatedHook` | `author.{id, email}`, `target_id`, `reaction_type`, `created_at` | ✅ scoring only. |
| `RsvpCreatedHook` | `id` (member), `email`, `event_id`, `event_name`, `event_starts_at`, `rsvp_status` | ✅ scoring only. **Event name/date not captured.** |
| `LiveCallStartedHook` / `LiveCallAttendedHook` | call_id, attended_at, duration | ❌ — live attendance is a strong engagement signal. |
| `DirectMessageSentHook` | sender, recipient, sent_at | ❌ — usually high-noise; consider only if you want DM activity in HubSpot. |

### Space / community structure (currently fully wired)

| Mighty event             | Payload typically includes          | Wired?                                                          |
| ------------------------ | ----------------------------------- | --------------------------------------------------------------- |
| `SpaceCreatedHook`       | space_id, creator, created_at, type | ❌ — only relevant if LifeStarr lets members create spaces.      |
| `SpaceMemberAddedHook`   | space_id, member_id, added_at       | ❌ — could populate a "tracks" property if spaces map to tracks. |
| `SpaceMemberRemovedHook` | space_id, member_id, removed_at     | ❌                                                               |

---

## Part 4 — Recommended new HubSpot properties to add

Bucketed by purpose. Each row is a property we'd create in the `lifestarr` group, plus the Mighty data that would feed it.

### Identity / profile (capture more from MemberJoined / MemberUpdated) - (currently fully wired)


| New property                     | Type              | Source                                           | Why useful                                                   |
| -------------------------------- | ----------------- | ------------------------------------------------ | ------------------------------------------------------------ |
| `lifestarr_profile_bio`          | string (textarea) | `payload.bio`                                    | Sales/CS context — see who they are without leaving HubSpot. |
| `lifestarr_location`             | string            | `payload.location`                               | Geo-targeting / regional cohort analysis.                    |
| `lifestarr_timezone`             | string            | `payload.timezone`                               | Schedule-friendly outreach timing.                           |
| `lifestarr_profile_image_url`    | string            | `payload.profile_image_url`                      | Personal touch in HubSpot views.                             |
| `lifestarr_referral_source`      | string            | `payload.referral_source` or query param at join | Attribution beyond what HubSpot's analytics catches.         |
| `lifestarr_invited_by_member_id` | string            | `MemberInvitedHook.inviter_id`                   | Build a referral graph.                                      |

### Monetization — fuller picture

| New property | Type | Source | Why useful |
|---|---|---|---|
| `lifestarr_lifetime_revenue` | number | sum of all `MemberPurchased.amount` + `MemberSubscriptionRenewed.amount` | LTV segmentation in HubSpot lists. |
| `lifestarr_last_purchase_date` | date | latest `MemberPurchased.purchased_at` | Recency cohort. |
| `lifestarr_next_renewal_date` | date | latest `MemberSubscriptionRenewed.next_renewal_at` | Risk of cancellation visibility. |
| `lifestarr_cancel_reason` | string | `MemberSubscriptionCanceled.reason` | Why are people leaving? Categorize for win-back sequences. |
| `lifestarr_payment_method` | enum (card/bank/paypal) | `MemberPurchased.payment_method` | Payment-failure triage. |
| `lifestarr_subscription_paused_until` | date | `MemberSubscriptionPaused.resume_at` | Don't dun a paused member. |

### Engagement — beyond the rolled-up score

| New property | Type | Source | Why useful |
|---|---|---|---|
| `lifestarr_total_posts` | number | running count of `PostCreated` | Identify content creators. |
| `lifestarr_total_comments` | number | running count of `CommentCreated` | Engagement depth. |
| `lifestarr_total_rsvps` | number | running count of `RsvpCreated` | Live event participation. |
| `lifestarr_courses_completed` | number | count of `CourseProgressCompleted` | Real progress, not just score. |
| `lifestarr_last_active_date` | date | most recent of any engagement event | Inactivity-triggered campaigns. |
| `lifestarr_most_active_space` | string | space_id with most events for this member | Track / community affinity. |

### Lifecycle — better signals for upsell/retention

| New property | Type | Source | Why useful |
|---|---|---|---|
| `lifestarr_days_since_join` | number | computed: today − `lifestarr_central_intro_account_created_date` | Tenure-based segments without computing in HubSpot lists. |
| `lifestarr_days_as_premier` | number | today − `lifestarr_premier_start_date` (if active) | Premier tenure. |
| `lifestarr_intro_to_premier_days` | number | premier_start_date − intro_created_date | Conversion-velocity metric. |
| `lifestarr_churn_risk_score` | number | Computed (e.g. engagement score declining + days_inactive) | If you want a custom churn model. |

---

## Part 5 — Suggested mappings to STANDARD HubSpot properties

These are HubSpot's built-in contact properties we should populate where it makes sense — keeps the contact record useful for non-LifeStarr-specific HubSpot views and reports.

| HubSpot standard property | Mighty source | Currently set? |
|---|---|---|
| `email` | `payload.email` | ✅ |
| `firstname` | `payload.first_name` | ✅ |
| `lastname` | `payload.last_name` | ✅ |
| `phone` / `mobilephone` | `payload.phone` (if Mighty captures) | ❌ check if Mighty exposes |
| `city` | parsed from `payload.location` | ❌ would require a parser |
| `country` | parsed from `payload.location` or `payload.country_code` | ❌ |
| `website` | `payload.website_url` (Mighty profile field) | ❌ |
| `lifecyclestage` | derived from plan/engagement state | ✅ set to SQL on join; could refine for purchased → "customer" |
| `hs_lead_status` | could derive from engagement_score buckets | ❌ optional |
| `hubspot_owner_id` | `HUBSPOT_DEFAULT_CONTACT_OWNER_ID` env (Joe) | ✅ create-only |
| `hs_marketable_status` | always Marketing Contact for new members | ✅ create-only — verifying behavior |

**Lifecycle stage refinement worth considering:**

| LifeStarr state | Suggested lifecyclestage |
|---|---|
| Just joined (intro) | `salesqualifiedlead` (current) ✅ |
| Active Premier subscriber | `customer` (currently NOT set automatically) ❌ |
| Subscription canceled or removed | `other` or back to `lead` for win-back | ❌ |

If you want, I can wire `MemberPurchased` to bump lifecyclestage to `customer` (when transitioning from intro → premier, that's the right move).

---

## Part 6 — Open questions and action items

### Verify after next live event

1. **Is `hs_marketable_status: "MARKETING_CONTACT"` actually flipping new contacts to Marketing in your HubSpot account?** If yes, we're set. If the contact is being created but not showing as Marketing, we add a follow-up call to `client.marketing.marketingContactsBulkApi.create()` after the contact creation.
2. **Does `mapMightyPlan` correctly identify your plan tiers?** Trigger a real Premier purchase (or wait for one), check the resulting `lifestarr_plan` value on the HubSpot contact. If wrong, we update keyword matching or switch to plan_id mapping.
3. **Are the new lifecycle/Central properties actually landing now that the Hook-suffix bug is fixed?** Should be visible on the next genuine `MemberJoined` event (post-deploy of commit `9178800`).

### Asks for George

1. **Lifecycle on purchase**: bump to `customer`? (Yes/No — easy 1-line change.)
2. **Tracks**: `lifestarr_track` is defined but never set. What input determines a member's track? (Spaces they join? A custom Mighty profile field? Manual?)
3. **Which new properties from Part 4 to add NOW** vs. which to defer? My recommendation:
   - **Add now** (1 hour total): `lifestarr_total_posts`, `lifestarr_total_comments`, `lifestarr_total_rsvps`, `lifestarr_courses_completed`, `lifestarr_last_active_date`, `lifestarr_days_since_join`, `lifestarr_lifetime_revenue`, `lifestarr_last_purchase_date`. These are low-risk, high-signal, easy increments to existing handlers.
   - **Defer** until we have real data flowing: `lifestarr_churn_risk_score`, `lifestarr_most_active_space`, the cancellation/payment_method properties.
   - **Skip** (cost > value for V1): everything in MemberInvited / Spaces / DirectMessage / LiveCall — those are nice but require new handlers.

### Items not blocked on you

If you say "build the recommended set", I'll:
1. Add the property definitions to `lib/hubspot-properties.ts`
2. Run `npm run setup:hubspot` (creates them in HubSpot)
3. Update the relevant handlers to maintain running counters / fields
4. Test, commit, push

Estimated effort: 60–90 min for the "add now" set above.

---

## Reference — current HubSpot custom property internal names

For your records, the 11 LifeStarr-managed properties already in HubSpot:

```
mighty_member_id
mighty_match_status
lifestarr_plan
lifestarr_plan_status
lifestarr_central_intro_account_created_date
lifestarr_central_account_created
lifestarr_premier_start_date
lifestarr_premier_renewal_date
lifestarr_engagement_score
lifestarr_premier_ready
lifestarr_track
```

All in property group `lifestarr`. Definitions live in `lib/hubspot-properties.ts`.
