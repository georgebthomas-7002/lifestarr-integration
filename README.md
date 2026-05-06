# LifeStarr Integration Hub

Webhook handler and dashboard for syncing Mighty Networks community data into HubSpot CRM.

Receives Mighty Networks webhook events, dispatches them through typed event handlers, mirrors community state into HubSpot (contacts, deals, custom properties), tracks engagement, and exposes a small operations dashboard for the Sidekick / LifeStarr team to monitor sync health.

## Stack

- **Next.js 16** (App Router, Turbopack, Cache Components)
- **TypeScript** (strict)
- **Tailwind CSS v4** + **shadcn/ui**
- **Auth.js v5** with **Resend** magic-link email
- **Drizzle ORM** on **Neon Postgres** (via Vercel Marketplace)
- **HubSpot API** (`@hubspot/api-client`)
- Hosted on **Vercel** (Fluid Compute)

## Local development

```bash
git clone https://github.com/georgebthomas-7002/lifestarr-integration.git
cd lifestarr-integration
npm install
cp .env.example .env.local   # then fill in values, or run `vercel env pull .env.local`
npm run db:migrate
npm run dev
```

Open http://localhost:3000.

## Project structure

```
app/                    # Next.js App Router
  api/webhook/          # Mighty webhook entry point (Phase 4)
  dashboard/            # Auth-gated operations UI (Phase 7)
  login/                # Magic-link sign-in (Phase 3)
lib/
  db/                   # Drizzle schema + client
  handlers/             # One file per Mighty event_type
  hubspot-client.ts     # Typed HubSpot API wrapper (Phase 5)
  router.ts             # Webhook event_type → handler dispatch (Phase 4)
  types.ts              # Mighty payload + HandlerResult types (Phase 4)
components/
  ui/                   # shadcn primitives
```

## Environment variables

See `.env.example` for the full list. Required for full operation:

| Variable | Used in | Purpose |
|---|---|---|
| `POSTGRES_URL` | Drizzle | Auto-set by Vercel/Neon link |
| `AUTH_SECRET` | Auth.js | `openssl rand -base64 32` |
| `AUTH_URL` | Auth.js | App URL (localhost or production) |
| `AUTH_RESEND_KEY` | Auth.js | Resend API key |
| `RESEND_FROM_EMAIL` | Auth.js | Verified sender address |
| `ALLOWED_EMAILS` | Auth.js | Comma-separated allowlist |
| `MIGHTY_WEBHOOK_SECRET` | webhook receiver | Bearer-token verification |
| `HUBSPOT_API_TOKEN` | HubSpot client | Private app token |
| `HUBSPOT_CUSTOMER_PIPELINE_ID` | deal handler | Customer pipeline ID |
| `HUBSPOT_NEW_PURCHASE_STAGE_ID` | deal handler | Initial deal stage ID |
| `ALERT_EMAIL` | alerts | Where retry-exhausted alerts go |

## Deployment

Pushes to `main` auto-deploy to Vercel. Preview branches get preview URLs.

## Build phases

- ✅ **Phase 1** — Next.js scaffold + Drizzle schema (this commit)
- ⏳ **Phase 2** — Vercel link + Neon DB + first migration
- ⏳ **Phase 3** — Auth.js + Resend magic-link
- ⏳ **Phase 4** — Webhook receiver + router + idempotency
- ⏳ **Phase 5** — HubSpot client + Tier-1 event handlers
- ⏳ **Phase 6** — Engagement scoring + Premier upsell trigger
- ⏳ **Phase 7** — Dashboard UI
- ⏳ **Phase 8** — Production polish + alerts + docs
- ⏳ **Phase 9** — Go live with real Mighty webhook

## Docs

- `docs/mighty-setup.md` — Mighty Networks webhook configuration (TBD)
- `docs/hubspot-setup.md` — HubSpot private app + custom properties (TBD)
