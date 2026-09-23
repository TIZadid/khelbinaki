# Khelbi Naki?

A free board for underground futsal in Bangladesh, with two boards:

- **GK Lagbe** — hosts post that they need a goalkeeper; keepers pick a game.
- **Opponent Lagbe** — a team with a turf posts that it needs a team to play; other
  teams take them on.

No accounts, no payments, no in-app chat — and no hosting bill: everything runs on
Cloudflare's free tiers.

- **Site:** https://khelbinaki.zlabz.workers.dev
- **API:** https://khelbinaki-api.zlabz.workers.dev

## How it works

1. A host posts a match (district, area, turf, kick-off, how many a side, length,
   cost) on one of the boards. Keeper posts price per head and say how many keepers;
   opponent posts name the team and price per team (their share of the turf). The
   host chooses how people reach them:
   - **Message me** — a keeper or team taps *Contact host* / *Contact team*, passes a
     spam check, and gets the host's number for WhatsApp or a call.
   - **Send me your number** — they leave their details; only the host sees them, on
     the private manage page.
2. Each board shows upcoming posts grouped by day in Bangladesh time. A post drops
   out by itself once it starts.
3. The host marks the post filled when they're sorted.

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
