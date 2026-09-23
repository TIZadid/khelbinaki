# Khelbi Naki — Project Context

This file gives an AI coding assistant (Claude Code, Copilot, etc.) working in this
folder the context it needs. Keep it updated as decisions change.

## What this is

A free-to-use marketplace for underground futsal in Bangladesh. Teams/hosts post
that they need a goalkeeper for a match (cost per head, turf/area, date/time).
Goalkeepers browse a public feed and contact the host directly. No accounts, no
payments, no in-app chat — contact happens over WhatsApp/phone.

Two boards share the posts table (owner decision 2026-09-23): **GK Lagbe**
(`listing_type = 'gk_needed'`, a game needs a keeper) and **Opponent Lagbe**
(`'opponent_needed'`, a team needs a team to play). Every board-specific word —
board name, buttons, cost unit, empty/filled copy — lives in `web/src/lib/listing.ts`;
never hard-code either board's copy in a page, and never call a board "open games".

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
  cost_per_head INTEGER, -- per head on gk_needed, PER TEAM on opponent_needed
  slots_needed INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'filled' | 'archived'
  contact_mode TEXT NOT NULL DEFAULT 'direct', -- 'direct' | 'requests' (migration 0002)
  district TEXT NOT NULL DEFAULT '', -- slug from src/lib/bd.ts, e.g. 'coxs-bazar' (migration 0004)
  division TEXT NOT NULL DEFAULT '', -- 'div-<division>', e.g. 'div-chattogram' (migration 0004)
  players_per_side INTEGER, -- 3..11, "5-a-side"; required for opponent posts (migration 0005)
  team_name TEXT, -- opponent posts only, required there (migration 0005)
  edit_token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

`interests` (migration 0002): id, post_id → posts(id) ON DELETE CASCADE, name, phone,
note, created_at; UNIQUE (post_id, phone). Only the post's host (edit token) can read them.

## Key behaviors to implement

1. **Feed query** only ever returns posts where `start_datetime > now()` and
   `status != 'archived'`. A post silently disappears from the live feed once its
   match time passes — this must happen automatically, not manually.
2. **Closing a post**: `PATCH /posts/:id` requires the matching `edit_token`,
   sets `status = 'filled'`.
3. **Archiving**: start with query-time filtering only (point 1). Only add a
   Cloudflare Cron Trigger + scheduled `UPDATE ... SET status='archived'` job if
   a "past posts / history" page is explicitly requested later.
4. **Contact** (owner decision 2026-09-22): the host's phone is never in a public
   response. Each post has a `contact_mode` chosen by the host:
   **direct** — a keeper taps "Contact host", passes Turnstile, and gets the number
   for `wa.me` / `tel:` links; **requests** — keepers leave name + phone + short note
   (`interests`), which only the host sees via their edit token, then the host
   WhatsApps them. Never build chat, inboxes, or paid relays/SMS.

5. **Keeper profile** lives only in the keeper's browser (localStorage key
   `khelbinaki.keeper.v1`): name, WhatsApp, areas, note. It pre-fills "I'm interested"
   and makes the feed open on the keeper's areas. Never send it anywhere except with
   an interest request.

7. **Places** (owner decision 2026-09-23): hosts pick a **district** from the fixed
   list in `src/lib/bd.ts` (8 divisions, 64 districts — the same file is copied into
   `api/` and `web/`, keep them identical) plus a free-text local `area` ("Mirpur 10").
   Keepers never type a place: they follow districts or whole divisions. A division's
   region slug is prefixed `div-` because every division shares its name with one of
   its districts.

6. **Alerts** (`alerts` table, migration 0003): keepers opt in to browser push
   (VAPID, bodyless — the service worker fetches the newest games) and/or Telegram.
   Regions (districts or `div-` divisions) are a lowercase comma-separated list;
   empty means anywhere in Bangladesh. New posts fan
   out in `waitUntil`; a failed alert must never fail the post. Secrets in the API
   Worker: `VAPID_PRIVATE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`
   (the local copy lives in gitignored `api/.dev.vars`).

## Build order (do in this sequence)

1. D1 schema as migrations (`api/migrations/0001_init.sql`), apply with `wrangler d1 migrations apply`.
2. Worker API: `POST /posts`, `GET /posts` (feed-filtered per above), `PATCH /posts/:id`.
3. Frontend: feed page, post-detail page (WhatsApp/tel links), post-creation form
   with Turnstile.
4. Deploy: `wrangler deploy` (API); frontend auto-deploys via Workers Builds on push to `main`.
5. Optional/later: Telegram bot announcement on new post, Web Push subscriptions
   by area, Cron Trigger for real archiving, opponent-team invite listing type,
   boosted/featured posts.

All of build order 1-4 plus the MVP feature roadmap shipped on 2026-09-22/23
(see docs/superpowers/specs/…-design.md §8). Turnstile is live: site key
`0x4AAAAAAFAQISNULqQDLara` (public, in web/src/components/Turnstile.tsx), secret in
the API Worker. `web/` deploys itself on push to `main`; its Worker (`web/src/worker/`)
adds per-game link previews.

## Commands

```
nvm use                        # always first: selects Node 22 from .nvmrc
npx npm@11 install <pkg>       # in api/: npm 10.9 crashes ("edgesOut") resolving vitest 4 peers
cd api && npm test             # API tests (Workers runtime, local D1)
cd web && npm test             # frontend tests
npx wrangler login
npx wrangler d1 create khelbinaki-db
cd api && npx wrangler d1 migrations create khelbinaki-db <name>   # new schema change
cd api && npx wrangler d1 migrations apply khelbinaki-db --local    # also after cloning or changing database_id
cd api && npx wrangler d1 migrations apply khelbinaki-db --remote
npx wrangler dev              # local API dev
npm run dev                   # local frontend dev
npx wrangler deploy           # deploy API
cd web && npm run build && npx wrangler deploy     # deploy frontend by hand (normally Git auto-deploy)
npx wrangler secret put <NAME>
```

## Style/scope guardrails for the assistant

- Prefer the simplest implementation that stays on the free tier over a more
  "correct" one that costs money or adds infrastructure (e.g. don't suggest
  Twilio for SMS, don't suggest a paid map API — use a plain area-name text
  field instead of geocoding unless asked).
- Keep the two boards separate: separate sections, separate "Need a keeper" /
  "Need an opponent" buttons and forms (`/new`, `/new/opponent`). No generic
  "Post a game". Alerts (push/Telegram) are for keeper posts only.
- Ask before adding any dependency that requires an account/API key on a
  non-Cloudflare, non-free service.

## API (Feature 1, `api/src/app.ts`)

| Method & path | Body | Success | Errors |
|---|---|---|---|
| `GET /posts?type=&area=&district=` | – | `200 {posts}` upcoming, non-archived, soonest first, max 100. `type` = `gk_needed` (default, for old clients and the push worker), `opponent_needed` or `all` (the home page) | `400` bad type |
| `GET /posts/:id` | – | `200 {post}` (past/filled too) | `404` |
| `POST /posts` | post fields + `listing_type` + `players_per_side` + `team_name` (opponent) + `district` + `contact_mode` + `turnstile_token` | `201 {post, edit_token}` | `400 invalid_json`, `400 validation {fields}`, `403 captcha_failed` |
| `PATCH /posts/:id` | `{edit_token, status: "open"\|"filled"}` | `200 {post}` | `400`, `403 forbidden`, `404` |
| `POST /posts/:id/contact` | `{turnstile_token}` | `200 {phone}` (direct mode only) | `404`, `409 requests_only`, `410 closed`, `403 captcha_failed` |
| `POST /posts/:id/interests` | `{name, phone, note?, turnstile_token}` | `201/200 {ok:true}` (requests mode) | `404`, `409 direct_only`, `410 closed`, `400`, `403`, `429 full` (30/post) |
| `GET /posts/:id/interests` | `Authorization: Bearer <edit_token>` | `200 {interests}` | `403 forbidden`, `404` |
| `POST /alerts` | `{subscription, regions[], turnstile_token}` | `201 {ok, regions}` — browser push | `400`, `403 captcha_failed` |
| `POST /alerts/off` | `{endpoint}` | `200 {ok}` | `400` |
| `POST /alerts/telegram` | `{regions[], turnstile_token}` | `201 {code, link}` | `403`, `503 telegram_unavailable` |
| `POST /telegram/:secret` | Telegram update | `200 {ok}` — `/start <code>` links a chat, `/stop` unlinks | `403` |
| `POST /telegram/setup/:secret` | – | `200 {ok}` — points Telegram at the webhook | `403`, `503 no_bot_token` |

- Phones are stored as `8801XXXXXXXXX` (wa.me format) and are **never** returned in public responses; `start_datetime` must include a timezone and is stored as UTC ISO.
- `edit_token` is only ever returned once, from `POST /posts`.
- CORS allow-list: `ALLOWED_ORIGINS` var in `api/wrangler.jsonc` (`*` = preview-URL wildcard).
- `TURNSTILE_SECRET`: local `api/.dev.vars` holds Cloudflare's always-pass test key; production has none yet, so
  creation returns `captcha_failed` until Feature 4 creates the real widget (`wrangler secret put TURNSTILE_SECRET`).

## Frontend design (redesign 2026-09-23)

Dark pitch + lime + Barlow stays the theme. Motion stack: `motion` (Framer Motion)
for reveals/layout/scroll-linked effects, `lenis` smooth scroll (mouse/trackpad only,
off for touch and reduced motion; go through `web/src/lib/smoothScroll.ts`, never
call `window.scrollTo` directly), and a three.js football in the hero
(`components/hero/Football3D.tsx`), lazy-loaded and skipped on Data Saver / no WebGL.
Everything must respect `prefers-reduced-motion`.

## Deployments

- GitHub: https://github.com/TIZadid/khelbinaki (push over SSH)
- API: https://khelbinaki-api.zlabz.workers.dev (deploy: `cd api && npm run deploy`)
- D1: `khelbinaki-db` (APAC), id `948b478a-834e-42ef-9be5-d7b62a4acbaf`
- Web: https://khelbinaki.zlabz.workers.dev (Worker `khelbinaki`, static assets, SPA fallback) via Workers Builds: push to `main` deploys, other branches upload preview versions
- workers.dev account subdomain: `zlabz` (shared by every Worker on this account)
- Cloudflare login: run `npx wrangler login` in your own terminal (the OAuth callback can't reach the assistant's sandbox)
