# Alerts page and Opponent Lagbe bot — design (Part 2)

Date: 2026-09-25 · Status: awaiting owner review

## Goal

One **Alerts** page where anyone picks which board(s) to hear about (GK Lagbe,
Opponent Lagbe, or both), which places, and how (this device, Telegram, or
both). Teams get told about new Opponent Lagbe posts; keepers only about GK
Lagbe posts. Each board speaks through its own Telegram bot: @gklagbebot and
@opponentlagbebot. Still free, still no accounts (accounts are Part 3).

## Data (migration 0007)

- `alerts` is rebuilt (SQLite can't change a CHECK constraint in place):
  - `channel` ∈ `push` | `telegram` (@gklagbebot) | `telegram_opp` (@opponentlagbebot)
  - new `boards TEXT NOT NULL` — comma list of listing types this alert wants.
    Existing rows become `gk_needed` (that's all they could be before).
    Telegram rows always hold their bot's one board.
  - `UNIQUE (channel, address)` stays, so one chat can follow both bots.
- `telegram_links` gains `bot TEXT NOT NULL DEFAULT 'gk'` (`gk` | `opp`).

## API

| Route | Change |
|---|---|
| `POST /alerts` | body gains `boards[]` (default `["gk_needed"]`; unknown values dropped; empty → 400) |
| `POST /alerts/regions` | body gains optional `boards[]`; updates both on this browser's alert |
| `POST /alerts/telegram` | body gains `board` (`gk_needed` \| `opponent_needed`, default GK) → link to that board's bot; `503 telegram_unavailable` if that bot has no token/username |
| `GET /alerts/telegram/:code` | response gains `board` |
| `POST /telegram/:secret` | @gklagbebot webhook (unchanged path) |
| `POST /telegram/opp/:secret` | new: @opponentlagbebot webhook — same commands (`/start <code>`, `/status`, `/places`, `/stop`), wording about teams and matches |
| `POST /telegram/setup/:secret` | points **both** bots at their webhooks (skips a bot with no token) |

New config: var `TELEGRAM_OPP_BOT_USERNAME = "opponentlagbebot"`, secret
`TELEGRAM_OPP_BOT_TOKEN`. Both bots share `TELEGRAM_WEBHOOK_SECRET`.

**Fan-out:** a new post reaches alerts whose `boards` include its type and whose
regions match. Telegram rows go out through their own bot. Opponent message:
`Opponent needed: FC Mirpur 10 · 6-a-side · Kings Arena, Mirpur, Dhaka · Fri 25 Sep 8:00 PM · ৳1500/team` + link.
**Push:** still bodyless; the service worker now shows the **newest** open post
across both boards (it's almost always the one that triggered the push), titled
"New on GK Lagbe" / "New on Opponent Lagbe".

## Web

- New page **`/alerts`** (menu, header nav, footer; GK board's "Get alerts" link
  and a new one on Opponent Lagbe open it with that board preselected via `?board=gk|opp`).
  1. **What for?** Two toggles in their board colours (amber GK Lagbe, green
     Opponent Lagbe); at least one on.
  2. **Where?** Up to 5 districts/divisions (same picker as the keeper profile);
     empty = anywhere. First visit copies places from the keeper profile.
  3. **How?** *This device* (push: on/off) and *Telegram* — one row per chosen
     board (Connect → Open Telegram → "On. Watching …" / Turn off), because each
     board has its own bot.
  - Changing boards or places updates everything already on (push via
    `/alerts/regions`, each Telegram key via its `/regions`). A line confirms it.
  - Choices are kept on this phone: `khelbinaki.alerts.v1 = { boards, regions }`.
  - Telegram keys become one per bot: `khelbinaki.telegram.v2 = { gk?: key, opp?: key }`;
    an old `v1` key is read once as the GK key.
- **Keeper profile** no longer holds the alert settings: it shows a short card
  linking to `/alerts`. Saving the profile no longer moves alerts (the Alerts
  page owns alert places), so there's one place to change them.

## Error handling

- A bot without a token: its Connect button says "Telegram alerts for this board
  aren't set up yet" (API 503) — the other board keeps working.
- Push unsupported / blocked: as today, per device.
- Turning a board off while its Telegram is connected: that bot's alert is turned
  off (so the toggle means what it says).

## Testing

- API: migration keeps old rows as GK; `POST /alerts` with boards; fan-out sends
  opponent posts only to alerts wanting them and through the opponent bot; GK
  unchanged; opponent webhook links a code created for `opp`, and refuses a GK code;
  setup hits both bots.
- Web: Alerts page — board toggles (never both off), places prefilled from
  profile, `?board=opp` preselects, changing places calls push + Telegram updates,
  one Telegram row per chosen board; old v1 Telegram key migrates to `gk`.

## Out of scope

Accounts / sign-in (Part 3); keeper count, delete post, My posts (Part 4).
