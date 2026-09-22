# Khelbi Naki?

A free board for underground futsal in Bangladesh. Hosts post that they need a
goalkeeper; keepers browse open games and get in touch. No accounts, no payments,
no in-app chat — and no hosting bill: everything runs on Cloudflare's free tiers.

- **Site:** https://khelbinaki.zlabz.workers.dev
- **API:** https://khelbinaki-api.zlabz.workers.dev

## How it works

1. A host posts a match (area, turf, kick-off, cost per head, keepers needed) and
   chooses how keepers reach them:
   - **Keepers message me** — a keeper taps *Contact host*, passes a spam check, and
     gets the host's number for WhatsApp or a call.
   - **Keepers send me their number** — keepers leave their details; only the host
     sees them, on the private manage page.
2. The feed shows upcoming games grouped by day in Bangladesh time. A game drops out
   by itself once it starts.
3. The host marks the game filled when they're sorted.

Keepers can save a profile (name, WhatsApp, areas) that stays on their own phone and
fills in "I'm interested" for them.

## Layout

```
api/   Cloudflare Worker (Hono) + D1 database and migrations
web/   Vite + React site, served by a Worker that also builds link previews
docs/  Design spec and implementation plans
```

## Running it

```bash
nvm use                 # Node 22
cd api && npm install && npm run dev      # API on :8787
cd web && npm install && npm run dev      # site on :5173

cd api && npm test      # API tests (real Workers runtime + local D1)
cd web && npm test      # site tests
```

First run: `cd api && npx wrangler d1 migrations apply khelbinaki-db --local`,
then `npx wrangler d1 execute khelbinaki-db --local --file=seed/dev.sql` for demo games.

## Deploying

The site deploys itself on every push to `main`. The API is deployed by hand:

```bash
cd api && npm run deploy
```

See `CLAUDE.md` for the full project rules and `docs/superpowers/` for the specs and plans.
