# HubSpot Setup

Step-by-step for connecting LifeStarr Integration Hub to a HubSpot account from scratch. ~15 minutes if you have HubSpot Admin access.

## Prerequisites

- A HubSpot account with at least the Free CRM tier
- HubSpot Admin (or Super Admin) role on the account
- Access to the LifeStarr Integration Hub repo + a way to run `npm run setup:hubspot` once you have the token

## 1. Create the Private App + token

1. Log into HubSpot
2. Click the **gear** icon (top right) → **Settings**
3. In the left nav, **Integrations** → **Private Apps**
4. Click **Create a private app**

### Basic Info tab

- **Name**: `LifeStarr Integration Hub`
- **Description**: `Webhook-driven sync from Mighty Networks community to HubSpot CRM`
- (Optional logo)

### Scopes tab

Check exactly these:

| Scope | Why |
|---|---|
| `crm.objects.contacts.read` | Look up contacts by email |
| `crm.objects.contacts.write` | Create/update contacts |
| `crm.schemas.contacts.read` | Verify custom property group + fields exist |
| `crm.schemas.contacts.write` | Auto-create the `lifestarr` property group |
| `crm.objects.deals.read` | (For future deal lookups) |
| `crm.objects.deals.write` | Create deals on `MemberPurchased` |
| `crm.schemas.deals.read` | Read pipeline + stage IDs |
| `crm.schemas.deals.write` | (Reserved for adding deal-side properties later) |
| `crm.objects.owners.read` | Future deal owner assignment |

Leave everything else **unchecked**. Don't grant `settings.users.read` or any tickets/files scopes — we don't need them.

### Create the app

Click **Create app** at the top right. HubSpot will show a confirmation modal warning that other admins can manage this token. Confirm.

### Copy the token

On the resulting page, click **Show token** in the **Access token** card. Copy the value (`pat-na1-...` for North American accounts, `pat-eu1-...` for EU accounts).

⚠️ **The token gives full access at the granted scopes.** Treat it like a password.

## 2. Save the token

Add to `.env.local` for local development:

```
HUBSPOT_API_TOKEN=pat-na1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Add to Vercel for production:

```bash
vercel env add HUBSPOT_API_TOKEN production preview development
```

Paste the token when prompted.

## 3. Create the custom properties

Run from the project root:

```bash
npm run setup:hubspot
```

The script idempotently:
1. Verifies the token works (calls the property groups list API)
2. Creates a property group named `lifestarr` if it doesn't already exist
3. Creates **21 custom contact properties** (as of 2026-05-07):

### Identity & matching

| Internal name | Type | Used for |
|---|---|---|
| `mighty_member_id` | string | Stable identity link to Mighty |
| `mighty_match_status` | enum | `matched` / `new_contact_unverified` / `duplicate_review_needed` |

### Plan / lifecycle

| Internal name | Type | Used for |
|---|---|---|
| `lifestarr_plan` | enum | `intro` / `premier_monthly` / `premier_annual` / `none` |
| `lifestarr_plan_status` | enum | `active` / `canceled` / `removed` / `past_due` |
| `lifestarr_central_account_created` | bool | True once member has joined the community |
| `lifestarr_central_intro_account_created_date` | date | When their Mighty account was created |
| `lifestarr_premier_start_date` | date | When Premier was first activated |
| `lifestarr_premier_renewal_date` | date | Most recent Premier renewal |

### Profile (synced from Mighty on MemberJoined / MemberUpdated)

| Internal name | Type | Used for |
|---|---|---|
| `lifestarr_profile_bio` | string | Short bio from Mighty profile |
| `lifestarr_location` | string | Free-form location string |
| `lifestarr_timezone` | string | IANA tz name |
| `lifestarr_profile_image_url` | string | URL of Mighty avatar |
| `lifestarr_mighty_profile_url` | string | Permalink to their Mighty profile |
| `lifestarr_referral_count` | number | Referrals tracked by Mighty |

### Engagement

| Internal name | Type | Used for |
|---|---|---|
| `lifestarr_engagement_score` | number | Rolling 30-day score |
| `lifestarr_premier_ready` | bool | Flips at score ≥ 50 (workflow trigger) |

### Spaces (Mighty community sub-spaces)

| Internal name | Type | Used for |
|---|---|---|
| `lifestarr_spaces` | enum (multi-select) | Space IDs the member is in. UI shows friendly names. |
| `lifestarr_space_membership_count` | number | Quick filter by activity breadth |
| `lifestarr_last_space_joined_at` | date | Recency of join activity |
| `lifestarr_last_space_left_at` | date | Recency of leave activity |
| `lifestarr_track` | enum | `foundation` / `growth` / `reset` / `unassigned` (auto-set when joining an entry space) |

> **Note:** `lifestarr_active_spaces` (text mirror) was deprecated on 2026-05-07 and archived in HubSpot. The multi-select `lifestarr_spaces` is the source of truth.

### Standard HubSpot properties our integration also writes

These existed before our integration; we just append/set them:

| Property | Behavior |
|---|---|
| `firstname`, `lastname`, `email` | Sync from Mighty payload |
| `lifecyclestage` | `salesqualifiedlead` for Intro members, `customer` for Premier |
| `hubspot_owner_id` | Joe Rando — set only when contact has no current owner (write-once) |
| `community_membership` (multi-select) | Append `LifeStarr Central` |
| `contact_type` (multi-select) | Append `Community Member` |

## 4. Configure the deal pipeline

`MemberPurchased` events create a deal in a specific pipeline + initial stage.

### Find the pipeline ID

1. HubSpot → **Settings** → **Objects** → **Deals** → **Pipelines** tab
2. Pick the pipeline new LifeStarr purchases should land in (typically the **Customer Pipeline** if it exists, or create a dedicated one)
3. Once selected, the URL contains `pipelineId=<numeric-id>` — that's `HUBSPOT_CUSTOMER_PIPELINE_ID`

### Find the stage ID

Stage IDs in custom pipelines are NOT the standard `appointmentscheduled` / `closedwon` strings — they're numeric (e.g. `66332849`). To list them:

```bash
node -e "
require('dotenv').config({path:'.env.local'});
const {Client} = require('@hubspot/api-client');
new Client({accessToken: process.env.HUBSPOT_API_TOKEN})
  .crm.pipelines.pipelinesApi
  .getById('deals', process.env.HUBSPOT_CUSTOMER_PIPELINE_ID)
  .then(p => p.stages.sort((a,b)=>a.displayOrder-b.displayOrder).forEach(s => console.log(s.displayOrder, s.label.padEnd(30), s.id)));
"
```

A Mighty `MemberPurchased` event represents an already-completed transaction (Mighty has collected payment), so the typical entry stage is **Closed Won**. Use whichever stage ID corresponds to that. Save as `HUBSPOT_NEW_PURCHASE_STAGE_ID`.

## 5. Set up the Premier upsell workflow (Joe's responsibility)

LifeStarr Integration Hub flips `lifestarr_premier_ready` to `true` when an Intro member's engagement score crosses 50 in a rolling 30-day window. Trigger your upsell sequence on that property change:

1. HubSpot → **Automation** → **Workflows** → **Create workflow** → **Contact-based**
2. Trigger: **Property is known/value changes** → `lifestarr_premier_ready` → equals `true`
3. Add filter: `lifestarr_plan` is `intro` (only target Intro members, not existing Premier subscribers)
4. Add your upsell steps (email sequence, sales notification, etc.)

## 6. Verify end-to-end

With the dev server running locally:

```bash
npm run test:webhook MemberPurchased
```

In HubSpot, search for `lifestarr-test+memberpurchased@sidekickstrategies.com` (or whatever email the test used) — you should see:
- A new contact with `lifestarr_plan = premier_monthly`
- A new deal in your Customer Pipeline at the configured stage

To clean up test data later, search HubSpot for `lifestarr-test+` and bulk-delete.
