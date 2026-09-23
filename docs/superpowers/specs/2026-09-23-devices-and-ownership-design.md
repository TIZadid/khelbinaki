# Devices and ownership without accounts — design

Date: 2026-09-23 · Status: awaiting owner review

## Goal

Every "different phone / lost access / done with it" situation for hosts and
keepers either works or is warned about in time — with no accounts, nothing
paid (no SMS, no WhatsApp Business API), and no new server-side personal data.

## What each person holds today

| Who | Held on the phone (localStorage) | Held on the server |
|---|---|---|
| Host | manage links: `khelbinaki.posts.v1` = `[{id, token}]` (also in the manage URL hash) | post, phone, edit token |
| Keeper | profile `khelbinaki.keeper.v2`; Telegram key `khelbinaki.telegram.v1`; push subscription (browser) | interests sent; alert rows |

## Cases and decisions

| # | Case | Decision |
|---|---|---|
| H1 | Host manages on the same phone | Works today. |
| H2 | Host manages from another phone | "Send the manage link to my WhatsApp" right after posting, plus the "Use on another phone" link. |
| H3 | Host lost the link | Unrecoverable for free — so warn before posting and right after. Post still expires on its own. |
| H4 | Host found someone | Existing "Mark as filled" / "We have an opponent". |
| H5 | Host wants it gone now | New **Delete post** (removes the post and its requests immediately). |
| H6 | Host posted wrong details | Delete and repost. No edit feature (YAGNI). |
| H7 | Host has several posts | New **My posts** page listing this phone's posts. |
| H8 | Host shares the manage link by mistake | Manage page says: share the post link, never this one. |
| K1 | Keeper on a new phone | Warning on the profile page + the "Use on another phone" link. |
| K2 | Keeper on two phones | Fine: alerts go to both. |
| K3 | Keeper deletes profile | Also turns off this phone's alerts (checkbox, on by default). |
| K4 | Keeper cleared browser data | Push dies by itself; Telegram stops with `/stop` (already in bot help). |
| K5 | Keeper withdraws a request | Out of scope — they tell the host on WhatsApp. |

## Design

### 1. "Use on another phone" link (client only)

- `web/src/lib/transfer.ts`: `bundle = { v: 1, keeper?, telegram?, posts? }` →
  JSON → base64url → `/move#d=<data>`. Everything after `#` never reaches a server.
- `/move` page: decodes and shows what it will copy (name and places, Telegram
  on/off, N posts), with **Copy to this phone**. Import merges: posts are
  deduped by id; profile and Telegram key replace this phone's (after saying
  so if one already exists). The hash is then wiped with `history.replaceState`
  so the data doesn't linger in the address bar.
- Bad or old links: "This link is broken or from an older version."
- Offered from the keeper page ("Using another phone?") and the manage page,
  with Copy and Share (share sheet / `wa.me/?text=`). Labelled
  "Private — anyone with this link can manage your posts and profile."

### 2. Right after posting

- `managePath` adds `&new=1`. The manage page then shows a banner:
  "Save this page's link — it's the only way to mark this post filled or
  delete it", with **Send to my WhatsApp** (`wa.me/?text=<manage link>`,
  pick your own chat) and **Copy**.
- The post form says the same in one line above the submit button.

### 3. Delete post

- API `DELETE /posts/:id` with `Authorization: Bearer <edit_token>` →
  `200 {ok:true}`; `403 forbidden`; `404 not_found`. Deletes interests, then
  the post (no reliance on FK cascade). CORS allows `DELETE`.
- Manage page: **Delete post** (danger style) → inline confirm
  "Delete for good? This also removes N requests." → on success the post is
  dropped from `khelbinaki.posts.v1` and the page shows "Deleted" with links to
  My posts and the boards.

### 4. My posts

- `/my-posts`: lists `khelbinaki.posts.v1`, fetching each post
  (`GET /posts/:id`). Shows board, title, time, status, and a Manage button.
  A 404 means it ended and was cleaned up (or deleted): shown as "Cleared",
  and dropped from the list.
- Linked from the menu/footer only when this phone has posts.

### 5. Keeper profile

- Intro line: "Saved on this phone only. Moving phones? Use 'Use on another phone' below."
- Delete profile: inline confirm with "Also turn off alerts on this phone"
  (checked) → disables push, turns Telegram off via its key, forgets the key.

### 6. Manage page copy

- Key section: "Share the post link with players — never this page's link."

## Testing

- API: DELETE with right token removes post + interests; wrong token 403;
  unknown 404; CORS preflight allows DELETE.
- Web: transfer encode/decode round-trip and rejection of junk; `/move`
  import merges posts and sets profile; manage delete confirm → DELETE call →
  removed from my posts; post-created banner shows with `new=1`; My posts shows
  "Cleared" for 404s; keeper delete turns alerts off when checked.

## Out of scope

Editing posts, withdrawing requests, any server-side account or recovery.
