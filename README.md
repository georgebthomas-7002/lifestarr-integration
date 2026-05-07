# LifeStarr Integration Hub

Webhook handler and operations dashboard that syncs Mighty Networks community events into HubSpot CRM.

Built by Sidekick Strategies for LifeStarr. Receives events from Mighty's webhook API, mirrors community state into HubSpot (contacts, deals, custom properties), tracks engagement on a rolling 30-day window, and exposes a clean dashboard for the team to monitor sync health and reconcile unmatched contacts.

## Architecture

```
            ┌──────────────────────┐
            │  Mighty Networks     │
            │  webhooks            │
            └──────────┬───────────┘
                       │ POST /api/webhook
                       │ Authorization: Bearer <secret>
                       ▼
   ┌─────────────────────────────────────────────────┐
   │  Next.js 16 App Router on Vercel (Fluid Compute)│
   │                                                 │
   │  /api/webhook  ─►  router.ts  ─►  handlers/     │
   │       │                              │          │
   │       │                              ▼          │
   │       ▼                        HubSpot API      │
   │  Neon Postgres                 (contacts/deals/ │
   │  (Drizzle ORM)                  custom props)   │
   │       │                                         │
   │       ▼                                         │
   │  /dashboard  (status, activity, review, etc.)   │
   └─────────────────────────────────────────────────┘
```

## Stack

- **Next.js 16** (App Router, Turbopack, Cache Components, Fluid Compute on Vercel)
- **TypeScript** (strict)
- **Tailwind v4** + **shadcn/ui**
- **Auth.js v5** + **Resend** for magic-link auth on the dashboard
- **Drizzle ORM** on **Neon Postgres** (via Vercel Marketplace)
- **HubSpot API** via `@hubspot/api-client`
- **Vercel Analytics**

## Local development

```bash
git clone https://github.com/georgebthomas-7002/lifestarr-integration.git
cd lifestarr-integration
npm install
vercel link                                # one-time, links to the Vercel project
vercel env pull --environment=production .env.local
npm run db:migrate                         # applies any pending migrations
npm run setup:hubspot                      # idempotently creates custom properties in HubSpot
npm run seed:integrations                  # creates the 7 dashboard integration cards
npm run dev
```

Open http://localhost:3000 — root redirects to `/dashboard`.

### Smoke-test the webhook locally

In a second terminal:

```bash
npm run test:webhook                       # fires a sample MemberPurchased
npm run test:webhook MemberJoined          # specific event type
npm run test:webhook MemberPurchased custom@email.com   # pin the email
npm run test:webhook:bad-auth              # confirms bearer-token rejection
```

Each fire creates a row in `webhook_events`, runs the handler, hits HubSpot, and updates counters on the integration card.

## Project structure

```
app/
  api/webhook/route.ts        Mighty webhook entry point (POST, bearer auth)
  dashboard/                  Operations UI
    page.tsx                  Status grid (7 integration cards)
    activity/page.tsx         Last 50 events, filters, retry
    progress/page.tsx         The 7 yeses with progress bars
    review/page.tsx           needs_review_queue (manual reconciliation)
    settings/page.tsx         Env / config overview
    actions.ts                Server actions: toggleIntegrationStatus,
                              retryWebhook, markReviewResolved
  page.tsx                    Redirects to /dashboard
  layout.tsx                  Root layout (fonts, Vercel Analytics)
lib/
  db/                         Drizzle schema + lazy-init client
  handlers/                   One file per Mighty event_type + engagement.ts
  hubspot-client.ts           Typed @hubspot/api-client wrapper
  hubspot-properties.ts       Custom property definitions (single source of truth)
  engagement.ts               Rolling 30-day score math + HubSpot sync
  router.ts                   event_type → handler dispatch
  process-outcome.ts          Updates webhook_events + integrations after dispatch
  replay-webhook.ts           Manual retry (used by dashboard)
  verify-webhook.ts           Timing-safe bearer-token check
  alert.ts                    Resend-backed failure email
  types.ts                    MightyWebhookPayload, HandlerResult
  integrations-config.ts      Definitions of the 7 dashboard cards
  progress-data.ts            Hardcoded data for the Build Progress page
  format-time.ts              relativeTime() / isoDate()
components/
  ui/                         shadcn primitives
  dashboard-nav.tsx           Sidebar with active-link highlighting
  status-badge.tsx            Integration + WebhookEvent status badges
scripts/
  setup-hubspot-properties.ts Creates HubSpot property group + 9 custom props
  seed-integrations.ts        Inserts/updates the 7 integration cards
  test-webhook.ts             Local end-to-end test driver
  test-webhook-bad-auth.ts    Verifies 401 on bad bearer token
drizzle/                      Generated migrations (committed)
docs/
  hubspot-setup.md            Private App + pipeline + property setup
  mighty-setup.md             Mighty webhook configuration
```

## Environment variables

| Variable | Required | Used by | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | runtime, migrations | Neon Postgres connection (auto-provisioned by Vercel-Neon integration) |
| `MIGHTY_WEBHOOK_SECRET` | yes | webhook receiver | Bearer-token check for inbound Mighty events |
| `HUBSPOT_API_TOKEN` | yes | handlers | HubSpot Private App token |
| `HUBSPOT_CUSTOMER_PIPELINE_ID` | yes | MemberPurchased | Pipeline new deals land in |
| `HUBSPOT_NEW_PURCHASE_STAGE_ID` | yes | MemberPurchased | Initial deal stage |
| `AUTH_SECRET` | Phase 3 | Auth.js | `openssl rand -base64 32` |
| `AUTH_URL` | Phase 3 | Auth.js | App URL |
| `AUTH_RESEND_KEY` | Phase 3 + alerts | Auth.js, alert.ts | Resend API key |
| `RESEND_FROM_EMAIL` | Phase 3 + alerts | Auth.js, alert.ts | Sender email (verified domain or `onboarding@resend.dev` sandbox) |
| `ALLOWED_EMAILS` | Phase 3 | Auth.js | Comma-separated dashboard sign-in allowlist |
| `ALERT_EMAIL` | optional | alert.ts | Recipient for failure alerts |
| `WEBHOOK_URL` | optional | test scripts | Override webhook URL for local testing |

`vercel env pull --environment=production .env.local` syncs everything except secrets that Vercel marks "Sensitive" (DB credentials from Neon are pull-able; Marketplace-injected secrets sometimes aren't — copy from the Storage page if needed).

## Deployment

Pushes to `main` auto-deploy to production via Vercel's GitHub integration. Preview branches get preview URLs. The lazy-init pattern in `lib/db/index.ts` and `lib/hubspot-client.ts` means the build doesn't require runtime env vars to succeed.

```bash
vercel              # preview deploy from CLI (rare — prefer git push)
vercel --prod       # production deploy from CLI
```

After a fresh production deploy, point the Mighty webhook at:

```
https://lifestarr-integration.vercel.app/api/webhook
```

and configure it with your `MIGHTY_WEBHOOK_SECRET` as the bearer token. See [docs/mighty-setup.md](docs/mighty-setup.md).

## Adding a new event handler

1. Add the event_type to `lib/types.ts` `MightyEventType`.
2. Create `lib/handlers/<your-event>.ts` exporting an async function with signature `(payload: MightyWebhookPayload) => Promise<HandlerResult>`.
3. Use the helpers in `lib/handler-utils.ts`:
   - `extractMember(payload)` for member-shaped payloads
   - `findContactForMighty({ payload, reason })` to look up + auto-flag
   - `mapMightyPlan(member)` to map plan name → enum
   - For engagement-style scoring, use `recordEngagementEvent` + `syncEngagementToHubspot` from `lib/engagement.ts`
4. Register the handler in `lib/handlers/index.ts` under the exact Mighty `event_type` string.
5. (Optional) Add a sample payload to `scripts/test-webhook.ts` so `npm run test:webhook YourEvent` works.
6. (Optional) Add an integration card in `lib/integrations-config.ts` and re-seed (`npm run seed:integrations`).

## Engagement scoring

Configurable in `lib/engagement.ts`:

| Event | Points |
|---|---|
| MemberCourseProgressStarted | 5 |
| MemberCourseProgressCompleted | 20 |
| PostCreated | 10 |
| CommentCreated | 5 |
| RsvpCreated | 8 |
| ReactionCreated | 1 |

Threshold: 50 points in a rolling 30-day window flips `lifestarr_premier_ready` to `true` on the contact's HubSpot record. Joe's HubSpot workflow keys off that property to launch the Premier upsell sequence.

Full reference (window mechanic, HubSpot writeback, dashboard surfaces, tuning levers): [docs/engagement-scoring.md](docs/engagement-scoring.md).

## Troubleshooting

**Webhook returns 401**: bearer token mismatch. Verify `MIGHTY_WEBHOOK_SECRET` matches what Mighty is sending and that the value lives in Vercel's production env vars.

**Build fails with "X is not set"**: a module is checking an env var at import time instead of lazy-loading. The DB and HubSpot clients are already lazy — if you add a new env-dependent module, follow that pattern.

**Drizzle migration fails locally**: `vercel env pull --environment=production .env.local` and confirm `DATABASE_URL` has a real value (Marketplace-managed values can come down empty — copy from the Vercel Storage page if so).

**HubSpot "Pipeline X does not contain stage Y"**: pipeline stage IDs are different from the standard Sales pipeline. Check the actual stage IDs:

```bash
node -e "require('dotenv').config({path:'.env.local'}); const {Client} = require('@hubspot/api-client'); new Client({accessToken: process.env.HUBSPOT_API_TOKEN}).crm.pipelines.pipelinesApi.getById('deals', process.env.HUBSPOT_CUSTOMER_PIPELINE_ID).then(p => p.stages.forEach(s => console.log(s.displayOrder, s.label, s.id)))"
```

**Dashboard shows zeros for an integration that should have fired**: the `integrations` table may not be seeded for that event type. Run `npm run seed:integrations`.

## Setup guides

- [docs/mighty-setup.md](docs/mighty-setup.md) — Configuring the Mighty Networks webhook
- [docs/hubspot-setup.md](docs/hubspot-setup.md) — Creating the HubSpot Private App, custom properties, and pipeline
- [docs/engagement-scoring.md](docs/engagement-scoring.md) — How the rolling-30 score and Premier-ready threshold work

## Build phases

- ✅ Phase 1 — Next.js scaffold + Drizzle schema
- ✅ Phase 2 — Vercel link + Neon DB + first migration
- ⏳ Phase 3 — Auth.js + Resend magic-link (parked on verified-domain DNS)
- ✅ Phase 4 — Webhook receiver + router + idempotency
- ✅ Phase 5 — HubSpot client + 6 Tier-1 event handlers
- ✅ Phase 6 — Engagement scoring + Premier upsell trigger
- ✅ Phase 7 — Dashboard UI (un-gated until Phase 3)
- ✅ Phase 8 — Production polish: alerts, analytics, docs
- ⏳ Phase 9 — Wire up the real Mighty webhook in production
