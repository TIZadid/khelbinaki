# Alerts Page and Opponent Lagbe Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One Alerts page to choose boards, places and channels; opponent posts alert teams through a second bot, @opponentlagbebot.

**Architecture:** Alerts rows gain a `boards` list and a third channel `telegram_opp`; fan-out filters by board and sends through the bot that owns the row. The Telegram webhook handler is shared and parameterised by a bot config (`gk` | `opp`). The web gets an `/alerts` page that owns alert choices (`khelbinaki.alerts.v1`) and per-bot Telegram keys (`khelbinaki.telegram.v2`).

**Tech Stack:** Cloudflare Workers + Hono + D1; Vite + React 19 + Tailwind 4; Vitest.

**Spec:** `docs/superpowers/specs/2026-09-25-alerts-page-design.md`

## Global Constraints

- Free only; no accounts (Part 3).
- Existing alert rows keep working as GK-only after the migration.
- Colours: GK surfaces use `LISTINGS.gk_needed.tone` (`board-gk`), opponent surfaces `board-opp`; no hex in components.
- Storage reads/writes wrapped in try/catch.
- `source ~/.nvm/nvm.sh && nvm use` before any npm/npx.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A phone that turned on GK alerts before this change (old `v1` Telegram key, push row with no boards) keeps getting GK alerts and shows as connected. *(Task 1 migration test; Task 3 key migration test.)*
2. A GK link code opened in the opponent bot (or vice versa) must not link anything. *(Task 2 test.)*
3. Only one bot configured (no `TELEGRAM_OPP_BOT_TOKEN` yet): GK alerts and GK connect keep working; opponent connect returns 503 with a clear message. *(Task 2 + Task 3 tests.)*
4. Turning a board off on the Alerts page while its Telegram is on turns that bot off; the other stays. *(Task 3 test.)*
5. Both board toggles can never be off at once. *(Task 3 test.)*

---

### Task 1: Schema — boards on alerts, bot on link codes

**Files:** Create `api/migrations/0007_alert_boards.sql`; modify `api/src/alerts/repo.ts`; test `api/test/alerts.test.ts`.

**Interfaces (produces):**
- `type AlertChannel = "push" | "telegram" | "telegram_opp"`
- `type Board = "gk_needed" | "opponent_needed"`; `normalizeBoards(input: unknown): string` (valid, unique, comma-joined; `""` if none)
- `saveAlert(db, id, channel, address, regions, boards)`
- `listAlertsFor(db, district, division, listingType): Promise<Alert[]>` — only rows whose boards include the type
- `updateAlertRegions(db, channel, address, regions, boards?)`
- `saveTelegramCode(db, code, regions, bot: "gk" | "opp")`; `claimTelegramCode(db, code, chatId, bot)` returns null when the code belongs to the other bot
- `telegramStatus` result gains `board: Board` for known codes

Migration:

```sql
-- Alerts say which boards they want; the opponent bot gets its own channel.
CREATE TABLE alerts_new (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL CHECK (channel IN ('push', 'telegram', 'telegram_opp')),
  address TEXT NOT NULL,
  regions TEXT NOT NULL DEFAULT '',
  boards TEXT NOT NULL DEFAULT 'gk_needed',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (channel, address)
);
INSERT INTO alerts_new (id, channel, address, regions, boards, created_at)
  SELECT id, channel, address, regions, 'gk_needed', created_at FROM alerts;
DROP TABLE alerts;
ALTER TABLE alerts_new RENAME TO alerts;
CREATE INDEX idx_alerts_channel ON alerts (channel);

ALTER TABLE telegram_links ADD COLUMN bot TEXT NOT NULL DEFAULT 'gk';
```

Tests: existing tests updated for the new signatures; new — push alert with `boards: ["opponent_needed"]` is returned by `listAlertsFor(..., "opponent_needed")` and not for GK; legacy default is GK.

### Task 2: API — boards in routes, second bot, fan-out by board

**Files:** `api/src/app.ts`, `api/src/alerts/notify.ts`, `api/wrangler.jsonc` (`TELEGRAM_OPP_BOT_USERNAME`), `api/worker-configuration.d.ts` (regenerate via `npx wrangler types` or add the two fields), tests `api/test/alerts.test.ts`.

**Interfaces:**
- `type Bot = { key: "gk" | "opp"; board: Board; channel: "telegram" | "telegram_opp"; token?: string; username?: string }`; `botsFor(env): Record<"gk"|"opp", Bot>`
- `POST /alerts` body `{ subscription, regions[], boards[], turnstile_token }`; `400` if boards empty after normalising
- `POST /alerts/regions` body `{ endpoint, regions[], boards?[] }`
- `POST /alerts/telegram` body `{ regions[], board?, turnstile_token }` → `{ code, link, board }`; `503 telegram_unavailable` when that bot lacks username
- `GET /alerts/telegram/:code` → `{ status, regions?, board? }`
- `POST /telegram/:secret` (gk) and `POST /telegram/opp/:secret` (opp) → shared `handleTelegram(c, bot)`
- `POST /telegram/setup/:secret` → `{ gk: {ok, description} | null, opp: {...} | null }`
- `notifyNewPost` filters by board, sends each Telegram row with its bot's token, and uses `alertMessage(post, siteUrl)` which words opponent posts as `Opponent needed: <team> · <format> · <place> · <when> · ৳X/team`.

Tests: opponent post reaches only opponent-wanting push + `telegram_opp` rows via the opp token URL; GK code sent to `/telegram/opp/...` replies "already used / other bot" and links nothing; opp connect without username → 503; setup calls both `setWebhook`s.

### Task 3: Web — Alerts page

**Files:** create `web/src/pages/AlertsPage.tsx` (+ test), `web/src/lib/alertPrefs.ts` (+ test); modify `web/src/lib/alerts.ts`, `web/src/components/keeper/AlertSettings.tsx` (becomes the channels part used by the page, taking `boards`), `web/src/App.tsx`, `web/src/components/AppShell.tsx`, `web/src/components/feed/Feed.tsx`, `web/src/pages/KeeperPage.tsx`, `web/public/sw.js`.

**Interfaces:**
- `alertPrefs.ts`: `type AlertPrefs = { boards: Board[]; regions: string[] }`; `loadAlertPrefs(): AlertPrefs` (default boards `["gk_needed"]`, regions from keeper profile); `saveAlertPrefs(p)`
- `alerts.ts`: `enablePush(regions, boards, token)`; `updatePushAlert(regions, boards)`; `loadTelegramKeys(): { gk?: TelegramKey; opp?: TelegramKey }` (reads v2, else migrates v1 into `gk`); `saveTelegramKey(bot, key|null)`; `telegramLink(regions, bot, token)`; `syncAlerts(prefs)` updates push + each connected bot for boards still on, and turns off a bot whose board was switched off.
- Page sections: What for? (two toggles in board colours, `aria-pressed`, the last one on can't be switched off), Where? (RegionSelect + chips, max 5), How? (device row + one Telegram row per chosen board). `?board=gk|opp` preselects on first visit.
- Keeper page: replace `<AlertSettings>` with a link card to `/alerts`; drop profile→alerts sync.
- Feed: GK "Get alerts for new games" → `/alerts?board=gk`; opponent tagline gets "Get alerts for new matches" → `/alerts?board=opp`.
- Menu/footer/nav: "Alerts".
- `sw.js`: fetch `/posts?type=all`, pick newest `created_at` among open posts; title "New on GK Lagbe" / "New on Opponent Lagbe".

Tests: toggles (never both off), `?board=opp`, places prefilled from profile, saving places calls `/alerts/regions` and Telegram `/regions`, turning GK off with a GK key calls its `/off`, v1 key migrates.

### Task 4: Docs, deploy steps

Update `CLAUDE.md` (alerts section, API table, secrets list), run all tests + typecheck + build, commit. Deploy order: migration 0007 remote → API deploy → `POST /telegram/setup/<secret>` to point both bots → push web.
