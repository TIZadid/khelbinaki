# Continue with Telegram — design (Part 3)

Date: 2026-09-25 · Status: approved in conversation ("optional", "complete all the steps")

## Goal

An **optional** account, backed by Telegram, so a keeper's profile and a host's
posts follow them to any device. Everything still works without it (this-phone
only, as today). Free: Telegram Bot API only.

## Sign-in

1. **Tap (main path).** Site: `POST /auth/start {turnstile_token}` → `{code, links: {gk, opp}}`
   (`https://t.me/<bot>?start=login_<code>`, valid 15 min). The person taps, presses
   Start; the bot receives `/start login_<code>` **from their Telegram account**
   (Telegram vouches for `message.from.id`), marks the code with that id, creates
   the account if new (name = Telegram first + last name), and replies with a
   **Share my number** button. The site polls `GET /auth/poll/:code`; the first
   poll after Start swaps the code for a session (the code is deleted in the same
   statement, so it works once).
2. **Code (fallback, no Telegram on this device).** Send `/login` to either bot →
   it replies with a 6-digit code (10 min, one use). Site:
   `POST /auth/otp {code, turnstile_token}` → session. Turnstile on every try
   stops guessing.
3. **Verified number.** Sharing contact in the bot (`request_contact`) stores the
   account's phone **only if** `contact.user_id == from.id` (their own number)
   and it's a Bangladeshi mobile; stored as `8801XXXXXXXXX`.

## Data (migration 0008)

- `accounts (tg_id PK, name, phone NULL, note, regions, created_at, last_seen_at)`
- `sessions (token_hash PK, tg_id, created_at, last_used_at)` — the browser keeps the
  raw token (`khelbinaki.session.v1`); the server stores only its SHA-256.
- `login_codes (code PK, kind 'link'|'otp', tg_id NULL, created_at)`
- `posts.owner_tg_id` (nullable) — set when a signed-in host posts.

## API (`Authorization: Bearer <session>` where noted)

| Route | Result |
|---|---|
| `POST /auth/start` | `201 {code, links}`; `403` captcha |
| `GET /auth/poll/:code` | `200 {status:"waiting"}` or `200 {session, account}` once; `404` unknown/expired |
| `POST /auth/otp` | `200 {session, account}`; `400` wrong/expired code; `403` captcha |
| `POST /auth/logout` (session) | `200 {ok}` |
| `GET /me` (session) | `200 {account: {name, phone, note, regions[]}, posts: [{id, token}]}`; `401` |
| `PUT /me` (session) | `{name, note, regions[]}` → `200 {account}`; `400 validation`; `401` |
| `DELETE /me` (session) | removes account, sessions, its Telegram alerts and links; unlinks its posts → `200 {ok}` |
| `POST /posts` | if a valid session is sent, the post is owned by that account |

## Retention (hourly cleanup)

Accounts unused for **180 days** are deleted (same as `DELETE /me`); sessions
unused for 60 days; login codes after 1 day.

## Web

- **Keeper profile** page gets a *Continue with Telegram* card (top). Signed out:
  button → spam check → **Open Telegram** (+ waiting state) and "No Telegram on this
  device?" code entry. Signed in: "Signed in with Telegram as <name>", **Sign out**,
  **Delete my data** (confirm).
- Signed in, the profile form loads from and saves to the account (and this phone).
  The phone shows **Verified on Telegram** when it came from the bot; hosts see it
  as usual. On first sign-in, anything already saved on this phone fills gaps in
  the account.
- **My posts** also lists the account's posts (their manage tokens come from `/me`).
- **Post forms** send the session so the post is owned; host name/phone prefill from
  the account.

## Out of scope

Sign-in with anything but Telegram; editing the verified phone on the site (share
again in the bot to change it).
