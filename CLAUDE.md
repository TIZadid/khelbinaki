# Khelbi Naki — Project Context

This file gives an AI coding assistant (Claude Code, Copilot, etc.) working in this
folder the context it needs. Keep it updated as decisions change.

## What this is

A free-to-use marketplace for underground futsal in Bangladesh. Teams/hosts post
that they need a goalkeeper for a match (cost per head, turf/area, date/time).
Goalkeepers browse a public feed and contact the host directly. No accounts, no
payments, no in-app chat — contact happens over WhatsApp/phone.

Planned (not yet built): a second listing type where teams invite opponent teams
to play, reusing the same posts table and feed.

## Non-negotiable constraints

- **Zero hosting cost.** Everything must run on free tiers. Do not add a paid
  service, a paid API, or anything with a per-request/per-message cost (e.g. SMS
  OTP) without flagging it first — this project intentionally makes no money and
  the owner does not want to spend money on it either.
- **No login/accounts for MVP.** Posts are identified by a private edit token
  (a random string in the URL), not a user account.
- **No in-app messaging.** Contact is always via a `wa.me` deep link (WhatsApp)
  or `tel:` link. Do not build chat/inbox features.

## Stack

- **Frontend:** Vite + React, deployed as a Cloudflare Worker with static assets (free; `web/wrangler.jsonc`). Chosen over Pages on 2026-09-22 because the dashboard now defaults to Workers.
- **API:** Cloudflare Workers + Hono framework.
- **DB:** Cloudflare D1 (SQLite at the edge, free tier).
- **Spam protection:** Cloudflare Turnstile on the post-creation form.
- **CLI/tooling:** Wrangler (`npx wrangler ...`) for D1, deploy, secrets, cron.

Do not introduce a different backend platform (Supabase, Firebase, etc.) without
discussing it first — the whole point of this stack is staying inside one free
Cloudflare account.

## Data model

```sql
CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  listing_type TEXT NOT NULL DEFAULT 'gk_needed', -- 'gk_needed' | 'opponent_needed' (future)
  host_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  area TEXT NOT NULL,
  turf_name TEXT,
  lat REAL,
  lng REAL,
  start_datetime TEXT NOT NULL, -- ISO 8601
  duration_minutes INTEGER,
  cost_per_head INTEGER,
  slots_needed INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'filled' | 'archived'
  edit_token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## Key behaviors to implement

1. **Feed query** only ever returns posts where `start_datetime > now()` and
   `status != 'archived'`. A post silently disappears from the live feed once its
   match time passes — this must happen automatically, not manually.
2. **Closing a post**: `PATCH /posts/:id` requires the matching `edit_token`,
   sets `status = 'filled'`.
3. **Archiving**: start with query-time filtering only (point 1). Only add a
   Cloudflare Cron Trigger + scheduled `UPDATE ... SET status='archived'` job if
   a "past posts / history" page is explicitly requested later.
4. **Contact links**: every post card/detail view renders
   `https://wa.me/<phone>?text=<url-encoded message referencing this specific post>`
   and a `tel:<phone>` fallback. Never build a messaging endpoint.

## Build order (do in this sequence)

1. D1 schema as migrations (`api/migrations/0001_init.sql`), apply with `wrangler d1 migrations apply`.
2. Worker API: `POST /posts`, `GET /posts` (feed-filtered per above), `PATCH /posts/:id`.
3. Frontend: feed page, post-detail page (WhatsApp/tel links), post-creation form
   with Turnstile.
4. Deploy: `wrangler deploy` (API), connect repo to Cloudflare Pages (frontend).
5. Optional/later: Telegram bot announcement on new post, Web Push subscriptions
   by area, Cron Trigger for real archiving, opponent-team invite listing type,
   boosted/featured posts.

## Commands

```
nvm use                        # always first: selects Node 22 from .nvmrc
npx npm@11 install <pkg>       # in api/: npm 10.9 crashes ("edgesOut") resolving vitest 4 peers
cd api && npm test             # API tests (Workers runtime, local D1)
cd web && npm test             # frontend tests
npx wrangler login
npx wrangler d1 create khelbinaki-db
cd api && npx wrangler d1 migrations create khelbinaki-db <name>   # new schema change
cd api && npx wrangler d1 migrations apply khelbinaki-db --local
cd api && npx wrangler d1 migrations apply khelbinaki-db --remote
npx wrangler dev              # local API dev
npm run dev                   # local frontend dev
npx wrangler deploy           # deploy API
npm run build && npx wrangler pages deploy dist   # deploy frontend (if not using Git auto-deploy)
npx wrangler secret put <NAME>
```

## Style/scope guardrails for the assistant

- Prefer the simplest implementation that stays on the free tier over a more
  "correct" one that costs money or adds infrastructure (e.g. don't suggest
  Twilio for SMS, don't suggest a paid map API — use a plain area-name text
  field instead of geocoding unless asked).
- Keep the opponent-invite feature in mind when touching the posts schema/feed
  (see `listing_type`), but do not build it until explicitly asked.
- Ask before adding any dependency that requires an account/API key on a
  non-Cloudflare, non-free service.

## Deployments

- GitHub: https://github.com/TIZadid/khelbinaki (push over SSH)
- API: https://khelbinaki-api.khelbinaki.workers.dev (deploy: `cd api && npm run deploy`)
- D1: `khelbinaki-db` (APAC), id `948b478a-834e-42ef-9be5-d7b62a4acbaf`
- Web: Worker `khelbinaki` (static assets, SPA fallback) via Workers Builds: push to `main` deploys, other branches upload preview versions
- Cloudflare login: run `npx wrangler login` in your own terminal (the OAuth callback can't reach the assistant's sandbox)
