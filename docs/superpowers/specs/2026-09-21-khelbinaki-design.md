# Khelbi Naki — Design Spec (MVP)

Companion to `CLAUDE.md` (product, stack, data model, constraints). This file adds
the decisions made on 2026-09-21: visual direction, animation approach, the
"buy me a cha" bKash option, research takeaways, and the feature roadmap.
Where this file and `CLAUDE.md` overlap, `CLAUDE.md` wins on product rules.

## 1. Environment facts (checked 2026-09-21)

- Machine default Node is **v14.21.3** (too old). **v22.22.0 is already installed
  via nvm**. The project pins Node 22 with `.nvmrc`; run `nvm use` in the repo.
  Do NOT change the machine-wide nvm default (other projects may rely on 14).
- Current package majors: wrangler 4.x (needs Node ≥22), vite 8.x
  (Node ^20.19 || ≥22.12), hono 4.x, tailwindcss 4.x, motion 13.x, react 19.x,
  typescript 7.x.
- Worker tests use **`@cloudflare/vitest-plugin`** (the successor of
  `@cloudflare/vitest-pool-workers`). It requires **vitest ^4.1** — do not
  install vitest 5 in `api/`.
- No git repo yet. The owner has Cloudflare and GitHub accounts; the GitHub
  CLI (`gh`) is not installed, and an SSH key exists at `~/.ssh/id_ed25519`.
- Deploys: the web app uses Cloudflare Pages' GitHub integration (push to
  `main` = production, other branches = preview URLs). The API deploys with
  `wrangler deploy`.

## 2. Repo layout

```
khelbinaki/
  CLAUDE.md
  .nvmrc                 # 22
  docs/superpowers/{specs,plans}/
  api/                   # Cloudflare Worker (Hono) + D1 migrations
  web/                   # Vite + React frontend (Cloudflare Pages)
```

Two independent npm packages (no workspaces) — each deploys separately.

## 3. Data model deviations from CLAUDE.md

- Schema lives in D1 **migrations** (`api/migrations/0001_init.sql`) instead of a
  single `schema.sql`, so the later opponent-invite listing type can ship as
  `0002_*.sql`, and tests can apply the same migrations.
- Adds `CHECK` constraints on `listing_type` and `status`, and an index on
  `(status, start_datetime)` for the feed query.
- `start_datetime` is always stored as UTC `Date.toISOString()`
  (`2026-10-01T14:00:00.000Z`). The feed compares against a **bound parameter**
  `new Date().toISOString()`, never SQLite `datetime('now')` — that returns
  `2026-10-01 14:00:00` (space instead of `T`), which breaks string comparison.

## 4. Visual direction

Reference: dark "crypto landing" screenshot — near-black ground, faint grid,
soft lime glow, bordered glassy cards, one highlighted card filled solid lime,
bold geometric headings with a lime-highlighted word.

**Palette (dark only).** Lime is a touch darker than the reference (~#C5F82A),
as requested:

| Token | Value | Use |
|---|---|---|
| `--background` | `#0b0e0a` | page ground (green-tinted black) |
| `--foreground` | `#eef3e6` | body text |
| `--card` | `#12160f` | cards |
| `--primary` | `#a6d421` | lime: CTAs, highlight word, featured card |
| `--primary-foreground` | `#0b0e0a` | text on lime |
| `--muted` / `--secondary` | `#1a2015` | chips, inputs |
| `--muted-foreground` | `#8d977f` | secondary text |
| `--accent` | `#1f2818` | hover fills |
| `--border` / `--input` | `#252d1e` | hairlines |
| `--ring` | `#a6d421` | focus rings |
| `--destructive` | `#ef4444` | errors |

Token names follow shadcn/ui so components copied from 21st.dev work unchanged.

**Type.** Headings: Sora 600/700. Body: Inter 400/500/600. Both from Google
Fonts (free). Bangla text falls back to the system Bangla font for now.

**Surfaces.** A fixed `PitchBackground`: faint football-pitch markings (SVG,
portrait pitch sliced to cover the screen, subtle mowing stripes) fading out
from the centre, plus a blurred lime glow at the top. Replaced the original
grid on 2026-09-22 at the owner's request. Cards are `GlowCard`s: bordered, semi-opaque,
with a cursor-following spotlight on hover. The "starting soon" post in the
feed uses the solid-lime highlighted variant (like the reference's middle card).

### 4a. Redesign synced (2026-09-22)

The live site follows the design canvas https://claude.ai/artifact/LvyPfzuNcjuk76DmDZ7tgi ("moody minimal").
Fonts: **Barlow** (body) and **Barlow Condensed** (`font-display`: headlines, times, prices) replace Inter/Sora.
Tokens: background `#0a0c09`, card `#111410`, hairlines `#1d2219`, button outlines `--line #2b3226`, secondary text
`#a3ab98`, captions `--subtle #8d977f`. No glow cards: the feed is thin-ruled rows, the hero has a "Next up" ticket
with a countdown, step numbers are outlined numerals, the game page has a sticky action bar on phones. Shared
helpers: `page-x` / `eyebrow` utilities (index.css) and `btn` class sets (`web/src/lib/ui.ts`). Screens for 4a–4e
(contact modes, keeper profile, post, manage, share) are already drawn on the canvas; build them to match.

### 4b. Reference round 2 (2026-09-22) — adopt without changing the palette

Owner shared five references (dark coffee-machine UI, brutalist "We design
without rules" studio, Top.5 American-football rankings, "We know the game"
agency, a soccer-club template). Rule: keep the dark + lime palette and the
current look; borrow structure and typography only.

| From | Borrow | Where |
|---|---|---|
| Coffee machine | One accent used sparingly on calm charcoal | Lime only on: prices, the soonest "starting soon" card, primary CTA, one heading word |
| Brutalist studio | Huge index numerals; hairline-bordered cells; `↗` on links; status cell with a dot | Big condensed `01/02/03`; live "N open games ●" pill; `↗` on CTAs |
| Top.5 rankings | Small labels with superscript counts; thin rules between rows | Feed group headings "Today ³" |
| "We know the game" | Huge outlined ghost words behind content; condensed uppercase words | Faint outlined "KHELBI" behind the hero |
| Soccer club | Countdown boxes; circle motif | Countdown on the "starting soon" card; pitch centre circle already in background |

New type token: `--font-condensed` = **Barlow Condensed** 600/700 (Google
Fonts, free) for numerals — times, prices, step numbers. Body/headings unchanged.

## 5. Animation approach (21st.dev)

21st.dev is a registry of copy-paste React + Tailwind (shadcn-style)
components, mostly animated with `motion`. No account or API key is needed to
copy them. We:

1. Set up shadcn conventions (`components.json`, `@/` alias, `cn()` util,
   shadcn token names) so 21st.dev code drops in.
2. Use `motion` (`motion/react`) for all animation.
3. Build three house primitives in setup (`FadeUp`, `GridBackground`,
   `GlowCard`); per-feature plans pick specific 21st.dev components
   (e.g. shimmer/border-beam button for "Post a match", animated tabs for
   area/time filters, number ticker for the cost, dialog for bKash) and adapt
   them to our tokens.
4. Every animation respects `prefers-reduced-motion` (`useReducedMotion()`).
   Motion is used for entrance/hover/feedback only — never to delay content.

## 6. Research takeaways (goalie-finder / BD turf apps)

Sources looked at: Rent A Keeper (BR), GoalieUp / Puck (hockey goalie finders),
subsneeded.com round-up, Turfly and TurfNation (Dhaka turf booking).

Adopted (fit the no-accounts, zero-cost rules):
- **Time-first feed**: group posts as *Today / Tomorrow / This week*; badge
  posts starting within 3 hours as "Starting soon" (highlighted card).
- **Area filter chips** built from the areas in current posts (any city —
  the product is nationwide, not Dhaka-only) — text area, no geocoding.
- **Price front and centre**: cost per head is the largest number on a card
  (৳ symbol).
- **One-tap contact**: WhatsApp button prefilled with a message naming the
  turf and time; `tel:` fallback.
- **Share to WhatsApp groups**: "Share" button creating a `wa.me/?text=` link
  containing the post URL — this is how futsal games spread in Dhaka.
- **Filled badge** so hosts can close posts and stop getting messages.

Deferred (need accounts, money, or infra): ratings/reviews, in-app payments,
geolocation matching, push notifications (listed in CLAUDE.md as later).

## 7. "Buy me a cha" (bKash)

Goal: let people tip via bKash Send Money without printing the owner's number.

Approach (free, no merchant account):
- The owner exports their **personal bKash "My QR"** image from the bKash app
  and saves it as `web/public/bkash-qr.png`.
- A small "Buy me a cha ☕" button in the footer opens a dialog showing the QR,
  with steps: open bKash → Scan QR → Send Money. On a phone, the dialog tells the
  user to screenshot the QR and use the bKash scanner's gallery option.
  (The gallery option is unconfirmed — check it in the bKash app before
  shipping the text.)
- The number never appears in HTML, JS, or the repo as text.

Honest limits (tell the owner): the QR encodes the number, and bKash shows the
recipient's number and name to the sender before they confirm. This hides the
number from people browsing the site, not from people who pay. Hiding it
completely needs a bKash Merchant or Personal Retail Account (paperwork and
transaction fees), which is out of scope under the zero-cost rule.

## 8. Feature roadmap — all shipped 2026-09-22/23

| # | Feature | State |
|---|---|---|
| 0 | Setup & foundation | ✅ |
| 1 | Posts API | ✅ |
| 2 | Feed page | ✅ |
| 3 | Post detail + contact | ✅ |
| 4a | Contact modes API (phone private, reveal, interests) | ✅ |
| 4b | Keeper profile (on-device) | ✅ |
| 4c | Contact on the site (Turnstile, reveal sheet, interest form) | ✅ |
| 4d | Post a match + host manage page | ✅ |
| 4e | Share everywhere + per-game link previews | ✅ |
| 5 | Design sync (canvas → site) | ✅ |
| 6 | Buy me a cha (bKash QR) | ✅ page built; needs the owner's QR image at `web/public/bkash-qr.png` |
| 7 | Polish (icons, manifest, robots, sitemap, README) | ✅ |

Later, only if wanted: Telegram/Web Push alerts for hosts and keepers, Cron archiving
with a history page, opponent-team listings, featured posts, Bangla copy, a custom domain.

## 9. Open questions (not blocking setup)

- ~~Brand name~~ Decided 2026-09-21: **Khelbi Naki** ("wanna play?"). Logo
  renders "Khelbi" + lime "Naki?". Resource names: `khelbinaki-api`,
  `khelbinaki-db`, Pages project `khelbinaki`.
- Bangla UI copy: English first; add Bangla strings in Polish if wanted.
