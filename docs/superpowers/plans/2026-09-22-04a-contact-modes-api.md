# Feature 4a: Contact Modes API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The host's phone number is never public. Each post picks a contact mode: `direct` (a keeper reveals the host's number with one spam-checked tap) or `requests` (keepers leave their name and number; only the host, holding the edit token, can list them).

**Architecture:** Migration `0002` adds `posts.contact_mode` and an `interests` table. `phone` leaves every public response. Two keeper endpoints share one gate (post exists, is open, has not started, is in the right mode) and the existing Turnstile check; the host lists interests with `Authorization: Bearer <edit_token>`. Validation gains a shared field reader so posts and interests validate the same way.

**Tech Stack:** Hono 4, D1, `@cloudflare/vitest-plugin` + vitest 4.1.

**Spec:** `CLAUDE.md` + `docs/superpowers/specs/2026-09-21-khelbinaki-design.md` §9 (added in Task 4 of this plan). Decision (owner, 2026-09-22): "Host chooses per post" between reveal-on-tap and keepers-send-their-number.

## Global Constraints

- Zero cost: no SMS, no paid relay numbers, no email service. Hosts are not notified of new interests (they check their private manage page; free push/Telegram alerts are a later option).
- No in-app messaging: interests are contact requests (name, phone, short note) shown only to the host, never a chat thread.
- `phone` (host's) appears in no public response; only `POST /posts/:id/contact` returns it, after Turnstile, for `direct` posts that are open and not started.
- A keeper's phone is visible only to that post's host.
- Every keeper action checks state first (cheap, no captcha burned), then validates input, then verifies Turnstile (tokens are single-use).
- Existing rules still hold: timestamps UTC ISO; `edit_token` returned only once from `POST /posts`; only `gk_needed` listings.
- Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## API contract (new and changed)

| Method & path | Body / headers | Success | Errors |
|---|---|---|---|
| `POST /posts` | + optional `contact_mode: "direct" \| "requests"` (default `direct`) | `201 {post, edit_token}` (`post` has `contact_mode`, **no `phone`**) | + `400 validation {fields.contact_mode}` |
| `GET /posts`, `GET /posts/:id` | – | posts have `contact_mode`, **no `phone`** | – |
| `POST /posts/:id/contact` | `{turnstile_token}` | `200 {phone}` | `404 not_found`, `409 requests_only`, `410 closed`, `403 captcha_failed` |
| `POST /posts/:id/interests` | `{name, phone, note?, turnstile_token}` | `201 {ok:true}` (new) / `200 {ok:true}` (same phone again) | `404`, `409 direct_only`, `410 closed`, `400 invalid_json`, `400 validation {fields}`, `403 captcha_failed`, `429 full` (30 per post) |
| `GET /posts/:id/interests` | `Authorization: Bearer <edit_token>` | `200 {interests: [{name, phone, note, created_at}]}` oldest first | `403 forbidden`, `404 not_found` |

Interest validation: `name` 1–60; `phone` Bangladeshi mobile (normalised to `8801XXXXXXXXX`); `note` ≤200 optional.

## File Map

```
api/migrations/0002_contact_modes.sql   contact_mode column, interests table
api/src/posts/validate.ts               + ContactMode, NewInterest, fieldReader, validateInterest, contact_mode on NewPost
api/src/posts/repo.ts                   PublicPost without phone; + ContactInfo, Interest, MAX_INTERESTS, getContactInfo, addInterest, listInterests
api/src/app.ts                          + gate, isHuman, readObject; contact + interests routes; Authorization in CORS
api/test/validate.test.ts               + contact_mode and validateInterest cases
api/test/posts.test.ts                  phone no longer public; clear interests too
api/test/contact.test.ts                new: reveal + interests routes
CLAUDE.md, spec                         new contact rules
```

---

### Task 1: Migration and validation

**Interfaces:**
- Produces: `type ContactMode = "direct" | "requests"`; `NewPost` gains `contact_mode: ContactMode`; `type NewInterest = { name: string; phone: string; note: string | null }`; `validateInterest(input: unknown): Validation<NewInterest>`. `normalizeBdPhone` and `validateNewPost(input, now)` keep their signatures.

- [ ] **Step 1: Create the migration**

Run: `cd api && npx wrangler d1 migrations create khelbinaki-db contact_modes` → creates `migrations/0002_contact_modes.sql`. Replace its contents:

```sql
-- Each post picks how keepers reach the host (owner decision 2026-09-22).
ALTER TABLE posts ADD COLUMN contact_mode TEXT NOT NULL DEFAULT 'direct'
  CHECK (contact_mode IN ('direct', 'requests'));

-- "I'm interested" requests for contact_mode = 'requests'. Visible only to the host.
CREATE TABLE interests (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (post_id, phone)
);

CREATE INDEX idx_interests_post ON interests (post_id, created_at);
```

- [ ] **Step 2: Write failing tests** — in `api/test/validate.test.ts`:

Change the import line to:

```ts
import { normalizeBdPhone, validateInterest, validateNewPost } from "../src/posts/validate";
```

In the test `accepts a minimal post, trims text, normalizes phone and time, applies defaults`, add `contact_mode: "direct",` as the last key of the expected `value` object (after `notes: null,`).

Append at the end of the file:

```ts
describe("contact_mode", () => {
  it("accepts direct and requests", () => {
    const r = validateNewPost({ ...valid, contact_mode: "requests" }, NOW);
    expect(r.ok && r.value.contact_mode).toBe("requests");
  });

  it("rejects anything else", () => {
    const r = validateNewPost({ ...valid, contact_mode: "email" }, NOW);
    expect(!r.ok && r.errors.contact_mode).toBeTruthy();
  });
});

describe("validateInterest", () => {
  it("accepts a keeper's name, phone and optional note", () => {
    expect(validateInterest({ name: " Mehedi ", phone: "019 1234 5678", note: " 5 yrs in goal " })).toEqual({
      ok: true,
      value: { name: "Mehedi", phone: "8801912345678", note: "5 yrs in goal" },
    });
    expect(validateInterest({ name: "Mehedi", phone: "01912345678" })).toEqual({
      ok: true,
      value: { name: "Mehedi", phone: "8801912345678", note: null },
    });
  });

  it("reports missing name, bad phone and long note", () => {
    const r = validateInterest({ phone: "123", note: "x".repeat(201) });
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(["name", "note", "phone"]);
  });
});
```

- [ ] **Step 3: Run to verify they fail** — `npm test` → `validateInterest` is not exported; the defaults test lacks `contact_mode`.

- [ ] **Step 4: Replace `api/src/posts/validate.ts`**

```ts
export type ContactMode = "direct" | "requests";

export type NewPost = {
  host_name: string;
  phone: string;
  area: string;
  turf_name: string | null;
  start_datetime: string;
  duration_minutes: number | null;
  cost_per_head: number | null;
  slots_needed: number;
  notes: string | null;
  contact_mode: ContactMode;
};

export type NewInterest = { name: string; phone: string; note: string | null };

export type Validation<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

const MAX_DAYS_AHEAD = 60;
const DAY_MS = 86_400_000;
const CONTACT_MODES: readonly string[] = ["direct", "requests"];
const PHONE_ERROR = "Enter a Bangladeshi mobile number like 01712345678";

// Bangladeshi mobile: 01[3-9] + 8 digits, optional 88 country code. Stored as 8801XXXXXXXXX for wa.me.
export function normalizeBdPhone(raw: string): string | null {
  const match = /^(?:88)?(01[3-9]\d{8})$/.exec(raw.replace(/\D/g, ""));
  return match ? `88${match[1]}` : null;
}

// Reads fields from an untrusted JSON body, collecting one error per bad field.
function fieldReader(input: unknown) {
  const body = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const text = (key: string, max: number, required: boolean): string | null => {
    const value = body[key];
    if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
      if (required) errors[key] = "Required";
      return null;
    }
    if (typeof value !== "string") {
      errors[key] = "Must be text";
      return null;
    }
    const trimmed = value.trim();
    if (trimmed.length > max) {
      errors[key] = `At most ${max} characters`;
      return null;
    }
    return trimmed;
  };

  const int = (key: string, min: number, max: number): number | null => {
    const value = body[key];
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
      errors[key] = `Whole number from ${min} to ${max}`;
      return null;
    }
    return value;
  };

  const phone = (key: string): string | null => {
    const raw = text(key, 20, true);
    if (raw === null) return null;
    const normalized = normalizeBdPhone(raw);
    if (!normalized) errors[key] = PHONE_ERROR;
    return normalized;
  };

  return { body, errors, text, int, phone };
}

export function validateNewPost(input: unknown, now: Date): Validation<NewPost> {
  const { body, errors, text, int, phone: readPhone } = fieldReader(input);

  if (body.listing_type !== undefined && body.listing_type !== "gk_needed") {
    errors.listing_type = "Only gk_needed posts are supported for now";
  }

  let contact_mode: ContactMode = "direct";
  if (body.contact_mode !== undefined) {
    if (typeof body.contact_mode === "string" && CONTACT_MODES.includes(body.contact_mode)) {
      contact_mode = body.contact_mode as ContactMode;
    } else {
      errors.contact_mode = "Choose direct or requests";
    }
  }

  const host_name = text("host_name", 60, true);
  const area = text("area", 60, true);
  const turf_name = text("turf_name", 80, false);
  const notes = text("notes", 500, false);
  const duration_minutes = int("duration_minutes", 15, 240);
  const cost_per_head = int("cost_per_head", 0, 10_000);
  const slots_needed = int("slots_needed", 1, 5) ?? 1;
  const phone = readPhone("phone");

  let start_datetime: string | null = null;
  const rawStart = text("start_datetime", 40, true);
  if (rawStart !== null) {
    const date = new Date(rawStart);
    if (Number.isNaN(date.getTime())) errors.start_datetime = "Invalid date/time";
    else if (!/(Z|[+-]\d{2}:\d{2})$/i.test(rawStart)) errors.start_datetime = "Include a timezone";
    else if (date <= now) errors.start_datetime = "Must be in the future";
    else if (date.getTime() - now.getTime() > MAX_DAYS_AHEAD * DAY_MS)
      errors.start_datetime = `At most ${MAX_DAYS_AHEAD} days ahead`;
    else start_datetime = date.toISOString();
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      host_name: host_name as string,
      phone: phone as string,
      area: area as string,
      turf_name,
      start_datetime: start_datetime as string,
      duration_minutes,
      cost_per_head,
      slots_needed,
      notes,
      contact_mode,
    },
  };
}

export function validateInterest(input: unknown): Validation<NewInterest> {
  const { errors, text, phone: readPhone } = fieldReader(input);
  const name = text("name", 60, true);
  const phone = readPhone("phone");
  const note = text("note", 200, false);

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name: name as string, phone: phone as string, note } };
}
```

- [ ] **Step 5: Run tests + typecheck** — `npm test && npm run typecheck`. Expected: validate tests pass. `posts.test.ts` may still pass or fail depending on `repo.ts` (unchanged yet); that's Task 2's job. Only validate tests must pass here.
- [ ] **Step 6: Commit** — `feat(api): contact_mode + interests migration, interest validation`

---

### Task 2: Repository and routes

**Interfaces:**
- Consumes: Task 1.
- Produces: `PublicPost` (no `phone`, + `contact_mode: ContactMode`); `type ContactInfo = { phone: string; status: PostStatus; start_datetime: string; contact_mode: ContactMode }`; `type Interest = { name: string; phone: string; note: string | null; created_at: string }`; `MAX_INTERESTS = 30`; `getContactInfo(db, id): Promise<ContactInfo | null>`; `addInterest(db, interestId, postId, interest: NewInterest): Promise<"created" | "duplicate" | "full">`; `listInterests(db, postId, token): Promise<Interest[] | "not_found" | "forbidden">`. Routes per the API contract.

- [ ] **Step 1: Update `api/test/posts.test.ts`**

In `beforeEach`, clear interests first:

```ts
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM interests").run();
  await env.DB.prepare("DELETE FROM posts").run();
});
```

In `creates a post and returns the edit token once`, remove the `phone: "8801712345678",` line from the `toMatchObject` object, add `contact_mode: "direct",` in its place, and after `expect(post).not.toHaveProperty("edit_token");` add:

```ts
    expect(post).not.toHaveProperty("phone");
```

In `lists only upcoming, non-archived posts…`, change the loop to:

```ts
    for (const p of posts) {
      expect(p).not.toHaveProperty("edit_token");
      expect(p).not.toHaveProperty("phone");
    }
```

- [ ] **Step 2: Write failing tests `api/test/contact.test.ts`**

```ts
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";

const NOW = new Date("2026-10-01T10:00:00.000Z");
const human = createApp({ verifyHuman: () => async () => true, now: () => NOW });
const bot = createApp({ verifyHuman: () => async () => false, now: () => NOW });
type App = typeof human;

const postBody = {
  host_name: "Rafi",
  phone: "01712345678",
  area: "Mirpur",
  start_datetime: "2026-10-01T14:00:00.000Z",
  turnstile_token: "tok",
};
const keeper = { name: "Mehedi", phone: "01912345678", note: "5 yrs in goal", turnstile_token: "tok" };

function send(a: App, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  return a.request(
    path,
    { method, headers: { "Content-Type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) },
    env,
  );
}

async function createPost(overrides: Record<string, unknown> = {}) {
  const res = await send(human, "POST", "/posts", { ...postBody, ...overrides });
  expect(res.status).toBe(201);
  return (await res.json()) as { post: { id: string; contact_mode: string }; edit_token: string };
}

const listAs = (id: string, token: string) => send(human, "GET", `/posts/${id}/interests`, undefined, { Authorization: `Bearer ${token}` });

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM interests").run();
  await env.DB.prepare("DELETE FROM posts").run();
});

describe("POST /posts/:id/contact (direct mode)", () => {
  it("reveals the host's phone after the captcha", async () => {
    const { post } = await createPost();
    expect(post.contact_mode).toBe("direct");
    const res = await send(human, "POST", `/posts/${post.id}/contact`, { turnstile_token: "tok" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ phone: "8801712345678" });
  });

  it("refuses bots", async () => {
    const { post } = await createPost();
    const res = await send(bot, "POST", `/posts/${post.id}/contact`, { turnstile_token: "tok" });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "captcha_failed" });
  });

  it("refuses requests-mode, filled, started and unknown posts", async () => {
    const requests = await createPost({ contact_mode: "requests" });
    expect((await send(human, "POST", `/posts/${requests.post.id}/contact`, { turnstile_token: "t" })).status).toBe(409);

    const filled = await createPost();
    await send(human, "PATCH", `/posts/${filled.post.id}`, { edit_token: filled.edit_token, status: "filled" });
    expect((await send(human, "POST", `/posts/${filled.post.id}/contact`, { turnstile_token: "t" })).status).toBe(410);

    await env.DB.prepare(
      "INSERT INTO posts (id, host_name, phone, area, start_datetime, edit_token) VALUES ('started001', 'X', '8801711111111', 'Mirpur', '2026-10-01T09:00:00.000Z', 't')",
    ).run();
    expect((await send(human, "POST", "/posts/started001/contact", { turnstile_token: "t" })).status).toBe(410);

    expect((await send(human, "POST", "/posts/nope/contact", { turnstile_token: "t" })).status).toBe(404);
  });
});

describe("interests (requests mode)", () => {
  it("records a keeper once and shows them only to the host", async () => {
    const { post, edit_token } = await createPost({ contact_mode: "requests" });

    expect((await send(human, "POST", `/posts/${post.id}/interests`, keeper)).status).toBe(201);
    const again = await send(human, "POST", `/posts/${post.id}/interests`, { ...keeper, name: "Mehedi H" });
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ ok: true });

    const res = await listAs(post.id, edit_token);
    expect(res.status).toBe(200);
    const { interests } = (await res.json()) as { interests: Record<string, unknown>[] };
    expect(interests).toHaveLength(1);
    expect(interests[0]).toMatchObject({ name: "Mehedi", phone: "8801912345678", note: "5 yrs in goal" });

    expect((await listAs(post.id, "wrong")).status).toBe(403);
    expect((await send(human, "GET", `/posts/${post.id}/interests`)).status).toBe(403);
    expect((await listAs("nope", edit_token)).status).toBe(404);
  });

  it("refuses direct-mode and closed posts", async () => {
    const direct = await createPost();
    const res = await send(human, "POST", `/posts/${direct.post.id}/interests`, keeper);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "direct_only" });

    const closed = await createPost({ contact_mode: "requests" });
    await send(human, "PATCH", `/posts/${closed.post.id}`, { edit_token: closed.edit_token, status: "filled" });
    expect((await send(human, "POST", `/posts/${closed.post.id}/interests`, keeper)).status).toBe(410);
  });

  it("validates before spending the captcha, and stores nothing for bots", async () => {
    const { post, edit_token } = await createPost({ contact_mode: "requests" });

    const invalid = await send(bot, "POST", `/posts/${post.id}/interests`, { ...keeper, phone: "123" });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ error: "validation", fields: { phone: expect.any(String) } });

    expect((await send(bot, "POST", `/posts/${post.id}/interests`, keeper)).status).toBe(403);
    const { interests } = (await (await listAs(post.id, edit_token)).json()) as { interests: unknown[] };
    expect(interests).toHaveLength(0);
  });

  it("caps interests per post", async () => {
    const { post } = await createPost({ contact_mode: "requests" });
    for (let i = 0; i < 30; i++) {
      await env.DB.prepare("INSERT INTO interests (id, post_id, name, phone) VALUES (?, ?, 'K', ?)")
        .bind(`int${i}`, post.id, `88017000000${String(i).padStart(2, "0")}`)
        .run();
    }
    const res = await send(human, "POST", `/posts/${post.id}/interests`, keeper);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "full" });
  });
});
```

- [ ] **Step 3: Run to verify they fail** — `npm test`: `contact.test.ts` fails (routes 404; `contact_mode` missing from responses); `posts.test.ts` fails (`phone` still public).

- [ ] **Step 4: Replace `api/src/posts/repo.ts`**

```ts
import type { ContactMode, NewInterest, NewPost } from "./validate";

export type PostStatus = "open" | "filled" | "archived";

export type PublicPost = {
  id: string;
  listing_type: string;
  contact_mode: ContactMode;
  host_name: string;
  area: string;
  turf_name: string | null;
  start_datetime: string;
  duration_minutes: number | null;
  cost_per_head: number | null;
  slots_needed: number;
  notes: string | null;
  status: PostStatus;
  created_at: string;
};

// What the keeper-action gate needs, including the private phone.
export type ContactInfo = {
  phone: string;
  status: PostStatus;
  start_datetime: string;
  contact_mode: ContactMode;
};

export type Interest = { name: string; phone: string; note: string | null; created_at: string };

export const MAX_INTERESTS = 30;

// Everything except edit_token and phone (both private) and lat/lng (unused for now).
const PUBLIC_COLUMNS =
  "id, listing_type, contact_mode, host_name, area, turf_name, start_datetime, duration_minutes, cost_per_head, slots_needed, notes, status, created_at";

const FEED_LIMIT = 100;

export async function insertPost(db: D1Database, id: string, editToken: string, post: NewPost): Promise<PublicPost> {
  const row = await db
    .prepare(
      `INSERT INTO posts (id, host_name, phone, area, turf_name, start_datetime, duration_minutes, cost_per_head, slots_needed, notes, contact_mode, edit_token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING ${PUBLIC_COLUMNS}`,
    )
    .bind(
      id,
      post.host_name,
      post.phone,
      post.area,
      post.turf_name,
      post.start_datetime,
      post.duration_minutes,
      post.cost_per_head,
      post.slots_needed,
      post.notes,
      post.contact_mode,
      editToken,
    )
    .first<PublicPost>();
  if (!row) throw new Error("insert returned no row");
  return row;
}

export async function listFeed(
  db: D1Database,
  now: Date,
  opts: { area?: string; listingType?: string } = {},
): Promise<PublicPost[]> {
  const where = ["listing_type = ?", "status != 'archived'", "start_datetime > ?"];
  const params: unknown[] = [opts.listingType ?? "gk_needed", now.toISOString()];
  if (opts.area) {
    where.push("area = ? COLLATE NOCASE");
    params.push(opts.area);
  }
  const { results } = await db
    .prepare(`SELECT ${PUBLIC_COLUMNS} FROM posts WHERE ${where.join(" AND ")} ORDER BY start_datetime ASC LIMIT ${FEED_LIMIT}`)
    .bind(...params)
    .all<PublicPost>();
  return results;
}

export async function getPost(db: D1Database, id: string): Promise<PublicPost | null> {
  return db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM posts WHERE id = ?`).bind(id).first<PublicPost>();
}

export async function getContactInfo(db: D1Database, id: string): Promise<ContactInfo | null> {
  return db
    .prepare("SELECT phone, status, start_datetime, contact_mode FROM posts WHERE id = ?")
    .bind(id)
    .first<ContactInfo>();
}

export async function setStatus(
  db: D1Database,
  id: string,
  token: string,
  status: "open" | "filled",
): Promise<"ok" | "not_found" | "forbidden"> {
  const res = await db
    .prepare("UPDATE posts SET status = ? WHERE id = ? AND edit_token = ? AND status != 'archived'")
    .bind(status, id, token)
    .run();
  if (res.meta.changes > 0) return "ok";
  const exists = await db.prepare("SELECT 1 FROM posts WHERE id = ?").bind(id).first();
  return exists ? "forbidden" : "not_found";
}

// Same phone twice on one post is ignored (UNIQUE), so resubmitting is harmless.
export async function addInterest(
  db: D1Database,
  interestId: string,
  postId: string,
  interest: NewInterest,
): Promise<"created" | "duplicate" | "full"> {
  const count = await db.prepare("SELECT COUNT(*) AS n FROM interests WHERE post_id = ?").bind(postId).first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_INTERESTS) return "full";
  const res = await db
    .prepare("INSERT OR IGNORE INTO interests (id, post_id, name, phone, note) VALUES (?, ?, ?, ?, ?)")
    .bind(interestId, postId, interest.name, interest.phone, interest.note)
    .run();
  return res.meta.changes > 0 ? "created" : "duplicate";
}

export async function listInterests(
  db: D1Database,
  postId: string,
  token: string,
): Promise<Interest[] | "not_found" | "forbidden"> {
  const owner = await db.prepare("SELECT edit_token FROM posts WHERE id = ?").bind(postId).first<{ edit_token: string }>();
  if (!owner) return "not_found";
  if (!token || owner.edit_token !== token) return "forbidden";
  const { results } = await db
    .prepare("SELECT name, phone, note, created_at FROM interests WHERE post_id = ? ORDER BY created_at ASC, rowid ASC")
    .bind(postId)
    .all<Interest>();
  return results;
}
```

- [ ] **Step 5: Replace `api/src/app.ts`**

```ts
import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import { isAllowedOrigin } from "./lib/origins";
import { randomId, randomToken } from "./lib/random";
import type { VerifyHuman } from "./lib/turnstile";
import {
  type ContactInfo,
  addInterest,
  getContactInfo,
  getPost,
  insertPost,
  listFeed,
  listInterests,
  setStatus,
} from "./posts/repo";
import { type ContactMode, validateInterest, validateNewPost } from "./posts/validate";

export type Deps = {
  verifyHuman: (env: Env) => VerifyHuman;
  now: () => Date;
};

type Ctx = Context<{ Bindings: Env }>;

// Keeper actions need an existing, open, not-yet-started post in the matching contact mode.
function gate(
  info: ContactInfo | null,
  mode: ContactMode,
  now: Date,
): { error: string; status: 404 | 409 | 410 } | null {
  if (!info) return { error: "not_found", status: 404 };
  if (info.contact_mode !== mode) return { error: mode === "direct" ? "requests_only" : "direct_only", status: 409 };
  if (info.status !== "open" || new Date(info.start_datetime) <= now) return { error: "closed", status: 410 };
  return null;
}

async function readObject(c: Ctx): Promise<Record<string, unknown> | null> {
  const body = await c.req.json<unknown>().catch(() => null);
  return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
}

export function createApp(deps: Deps) {
  const app = new Hono<{ Bindings: Env }>();

  const isHuman = async (c: Ctx, body: Record<string, unknown>) => {
    const token = body.turnstile_token;
    return typeof token === "string" && (await deps.verifyHuman(c.env)(token, c.req.header("CF-Connecting-IP") ?? null));
  };

  app.use(
    "*",
    cors({
      origin: (origin, c) => (isAllowedOrigin(origin, c.env.ALLOWED_ORIGINS) ? origin : null),
      allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      maxAge: 86400,
    }),
  );

  app.get("/health", (c) => c.json({ ok: true }));

  app.get("/posts", async (c) => {
    const area = c.req.query("area")?.trim() || undefined;
    return c.json({ posts: await listFeed(c.env.DB, deps.now(), { area }) });
  });

  app.get("/posts/:id", async (c) => {
    const post = await getPost(c.env.DB, c.req.param("id"));
    return post ? c.json({ post }) : c.json({ error: "not_found" }, 404);
  });

  app.post("/posts", async (c) => {
    const body = await readObject(c);
    if (!body) return c.json({ error: "invalid_json" }, 400);

    // Validate first: Turnstile tokens are single-use, so a typo shouldn't burn one.
    const result = validateNewPost(body, deps.now());
    if (!result.ok) return c.json({ error: "validation", fields: result.errors }, 400);
    if (!(await isHuman(c, body))) return c.json({ error: "captcha_failed" }, 403);

    const editToken = randomToken();
    const post = await insertPost(c.env.DB, randomId(), editToken, result.value);
    return c.json({ post, edit_token: editToken }, 201);
  });

  app.patch("/posts/:id", async (c) => {
    const { edit_token, status } = (await readObject(c)) ?? {};
    if (typeof edit_token !== "string" || (status !== "open" && status !== "filled")) {
      return c.json({ error: "validation" }, 400);
    }
    const id = c.req.param("id");
    const outcome = await setStatus(c.env.DB, id, edit_token, status);
    if (outcome === "not_found") return c.json({ error: "not_found" }, 404);
    if (outcome === "forbidden") return c.json({ error: "forbidden" }, 403);
    return c.json({ post: await getPost(c.env.DB, id) });
  });

  // Direct mode: a spam-checked tap reveals the host's number.
  app.post("/posts/:id/contact", async (c) => {
    const info = await getContactInfo(c.env.DB, c.req.param("id"));
    const blocked = gate(info, "direct", deps.now());
    if (blocked) return c.json({ error: blocked.error }, blocked.status);
    if (!(await isHuman(c, (await readObject(c)) ?? {}))) return c.json({ error: "captcha_failed" }, 403);
    return c.json({ phone: (info as ContactInfo).phone });
  });

  // Requests mode: a keeper leaves their details for the host.
  app.post("/posts/:id/interests", async (c) => {
    const id = c.req.param("id");
    const blocked = gate(await getContactInfo(c.env.DB, id), "requests", deps.now());
    if (blocked) return c.json({ error: blocked.error }, blocked.status);

    const body = await readObject(c);
    if (!body) return c.json({ error: "invalid_json" }, 400);
    const result = validateInterest(body);
    if (!result.ok) return c.json({ error: "validation", fields: result.errors }, 400);
    if (!(await isHuman(c, body))) return c.json({ error: "captcha_failed" }, 403);

    const outcome = await addInterest(c.env.DB, randomId(12), id, result.value);
    if (outcome === "full") return c.json({ error: "full" }, 429);
    return c.json({ ok: true }, outcome === "created" ? 201 : 200);
  });

  // Host only: the edit token proves ownership.
  app.get("/posts/:id/interests", async (c) => {
    const token = c.req.header("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const result = await listInterests(c.env.DB, c.req.param("id"), token);
    if (result === "not_found") return c.json({ error: "not_found" }, 404);
    if (result === "forbidden") return c.json({ error: "forbidden" }, 403);
    return c.json({ interests: result });
  });

  return app;
}
```

- [ ] **Step 6: Run all tests + typecheck** → all pass.
- [ ] **Step 7: Commit** — `feat(api): hide host phones; reveal-on-tap and interest requests per post`

---

### Task 3: Local smoke test

- [ ] **Step 1:** `npx wrangler d1 migrations apply khelbinaki-db --local` → `0002_contact_modes.sql` applied. Replace `api/seed/dev.sql` so both modes are covered:

```sql
-- Local demo data. Run with --local only; never against the production database.
DELETE FROM interests;
DELETE FROM posts;
INSERT INTO posts (id, host_name, phone, area, turf_name, start_datetime, duration_minutes, cost_per_head, slots_needed, notes, status, contact_mode, edit_token) VALUES
  ('seedsoon01', 'Rafi',   '8801712345678', 'Mirpur',     'Kings Arena',       strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+75 minutes'), 60,  150, 1, 'Bring gloves',          'open',   'direct',   'seed'),
  ('seedfill01', 'Tanvir', '8801812345678', 'Dhanmondi',  'Jaff Futsal',       strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+2 hours'),    60,  120, 1, NULL,                    'filled', 'direct',   'seed'),
  ('seedtoday1', 'Nabil',  '8801912345678', 'Mirpur',     'Striker Turf',      strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+5 hours'),    90,  200, 2, 'Friendly, mixed level', 'open',   'requests', 'seed'),
  ('seedtmrw01', 'Sakib',  '8801612345678', 'Agrabad',    NULL,                strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+1 day'),      60,  NULL, 1, NULL,                   'open',   'direct',   'seed'),
  ('seedtmrw02', 'Ayon',   '8801512345678', 'Uttara',     'Sector 7 Arena',    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+1 day', '+3 hours'), 60, 180, 1, NULL,            'open',   'direct',   'seed'),
  ('seedweek01', 'Fahim',  '8801312345678', 'Zindabazar', 'Sylhet Futsal Hub', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+3 days'),     60,  100, 1, NULL,                    'open',   'requests', 'seed');
```

Run: `npx wrangler d1 execute khelbinaki-db --local --file=seed/dev.sql`
- [ ] **Step 2:** With `npm run dev` (the `.dev.vars` test secret passes any token):
  - `curl -s localhost:8787/posts | grep -c phone` → `0`
  - `curl -s -X POST localhost:8787/posts/seedsoon01/contact -H 'Content-Type: application/json' -d '{"turnstile_token":"x"}'` → `{"phone":"8801712345678"}`
  - `curl -s -X POST localhost:8787/posts/seedtoday1/interests -H 'Content-Type: application/json' -d '{"name":"Mehedi","phone":"01912345678","turnstile_token":"x"}'` → `{"ok":true}`
  - `curl -s localhost:8787/posts/seedtoday1/interests -H 'Authorization: Bearer seed'` → one interest.
- [ ] **Step 3: Commit** — `chore(api): seed data covers both contact modes`

---

### Task 4: Docs, deploy

- [ ] **Step 1: `CLAUDE.md`**
  - Data model: add under the `posts` block: `contact_mode TEXT NOT NULL DEFAULT 'direct' -- 'direct' | 'requests' (migration 0002)` and a short `interests` table description (post_id, name, phone, note, created_at; unique per post+phone; host-only).
  - Replace Key behavior 4 with:
    `4. **Contact** (owner decision 2026-09-22): the host's phone is never in a public response. Each post has a contact_mode chosen by the host: **direct** — a keeper taps "Contact host", passes Turnstile, and gets the number to open wa.me / tel: links; **requests** — keepers leave name + phone + short note, which only the host sees on their private manage page (edit token), then the host contacts them by WhatsApp. Never build chat, inboxes or paid relays/SMS.`
  - API table: add the three new rows from this plan's contract, and mark `phone` as private.
- [ ] **Step 2: Spec** — add `## 9. Contact modes (2026-09-22)` to `docs/superpowers/specs/2026-09-21-khelbinaki-design.md` summarising the decision and the no-free-notifications trade-off; in §8 replace rows 4–5 with: `4a Contact modes API`, `4b Contact on the site (Turnstile widget, reveal button, interest form; cards drop phone)`, `4c Post a match + manage page (contact-mode choice, interested keepers, mark filled)`. Renumber the old "Open questions" to §10.
- [ ] **Step 3: Deploy** — `npx wrangler d1 migrations apply khelbinaki-db --remote` then `npm test && npm run deploy`. Safe to ship before the web changes: production has no posts (creation needs the Turnstile secret, set in 4b), so the old web code never meets a post without `phone`.
- [ ] **Step 4: Verify live** — `curl -s https://khelbinaki-api.zlabz.workers.dev/posts` → `{"posts":[]}`; `curl -s -X POST https://khelbinaki-api.zlabz.workers.dev/posts/x/contact -H 'Content-Type: application/json' -d '{}'` → `404 {"error":"not_found"}`.
- [ ] **Step 5: Commit and push** — `docs: contact modes in CLAUDE.md and spec`
