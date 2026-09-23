# Devices and Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hosts can delete posts, find their posts again, and save their manage link; keepers and hosts can move everything this phone knows to another phone with one private link — all without accounts.

**Architecture:** One new API route (`DELETE /posts/:id`, edit-token auth). Everything else is client-side: a transfer bundle encoded into the URL fragment (`/move#d=…`, never sent to a server), a My posts page built from the existing `khelbinaki.posts.v1` store, and copy/warnings on the post form, manage page and keeper page.

**Tech Stack:** Cloudflare Workers + Hono + D1 (API, Vitest with `@cloudflare/vitest-plugin`); Vite + React 19 + Tailwind 4 + Motion (web, Vitest + Testing Library + jsdom).

**Spec:** `docs/superpowers/specs/2026-09-23-devices-and-ownership-design.md`

## Global Constraints

- No accounts, no paid services (no SMS, no WhatsApp Business API); no new server-side personal data.
- Transfer data lives only after `#` in the URL; the `/move` page wipes it from the address bar after reading (`history.replaceState`).
- Storage keys stay: `khelbinaki.keeper.v2`, `khelbinaki.telegram.v1`, `khelbinaki.posts.v1`.
- Every localStorage read/write is wrapped in try/catch (private mode / blocked storage must not crash a page).
- Board-specific copy comes from `web/src/lib/listing.ts`; never write "open games"; keeper and opponent CTAs stay separate.
- Motion respects `prefers-reduced-motion` (use existing components; add no new animation libraries).
- Commands: always `source ~/.nvm/nvm.sh && nvm use` first. API tests `cd api && npm test`; web tests `cd web && npm test`; typecheck `cd web && npx tsc -b`, `cd api && npx tsc --noEmit`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A transfer link mangled by a chat app (cut short, extra characters) → `/move` says the link is broken; never throws or imports half a bundle. *(Task 2 test: `decodeBundle` rejects truncated input.)*
2. Importing onto a phone that already has a different keeper profile → the page says it will replace it and names both; nothing is overwritten before the tap. *(Task 3 test.)*
3. Deleting a post that the hourly cleanup already removed (API 404) → treated as done: dropped from My posts, shows "Deleted", no error. *(Task 4 test.)*
4. My posts while offline / API 500 → the row says "Couldn't load", and the post is **not** forgotten; only a 404 drops it. *(Task 5 test.)*
5. A manage link opened on a new phone (token in the hash) → that phone remembers the post, so it appears in My posts there. *(Task 4 test.)*

---

## File structure

| File | Responsibility |
|---|---|
| `api/src/posts/repo.ts` (modify) | `deletePost(db, id, token)` |
| `api/src/app.ts` (modify) | `DELETE /posts/:id`, CORS `DELETE` |
| `api/test/posts.test.ts` (modify) | delete tests |
| `web/src/lib/api.ts` (modify) | `deletePost(id, token)` client |
| `web/src/lib/myPosts.ts` (modify) | `forgetMyPost`, `mergeMyPosts`, `managePath(..., fresh)` |
| `web/src/lib/transfer.ts` (create) | bundle build / encode / decode / import |
| `web/src/lib/transfer.test.ts` (create) | round-trip + rejection |
| `web/src/components/MoveLink.tsx` (create) | "Use on another phone" card (copy + share) |
| `web/src/pages/MovePage.tsx` (create) + test | `/move` import page |
| `web/src/pages/MyPostsPage.tsx` (create) + test | `/my-posts` |
| `web/src/pages/ManagePage.tsx` (modify) + test | new-post banner, delete, key copy, MoveLink |
| `web/src/pages/KeeperPage.tsx` (modify) + test | device line, MoveLink, delete also turns alerts off |
| `web/src/pages/NewPostPage.tsx` (modify) | manage-link warning above submit |
| `web/src/App.tsx`, `web/src/components/AppShell.tsx` (modify) | routes, My posts links |
| `CLAUDE.md` (modify) | API table row, device rules |

---

### Task 1: API — delete a post with its edit token

**Files:**
- Modify: `api/src/posts/repo.ts` (append after `setStatus`)
- Modify: `api/src/app.ts` (CORS `allowMethods`; new route after `app.patch("/posts/:id", …)`)
- Test: `api/test/posts.test.ts` (new `describe("DELETE /posts/:id")` before `describe("CORS")`; extend the preflight test)

**Interfaces:**
- Produces: `DELETE /posts/:id`, header `Authorization: Bearer <edit_token>` → `200 {ok:true}` | `403 {error:"forbidden"}` | `404 {error:"not_found"}`.
- Produces (repo): `deletePost(db: D1Database, id: string, token: string): Promise<"ok" | "not_found" | "forbidden">`.

- [ ] **Step 1: Write the failing tests** — in `api/test/posts.test.ts`:

```ts
describe("DELETE /posts/:id", () => {
  it("deletes the post and its requests with the right token", async () => {
    const { post, edit_token } = await create({ contact_mode: "requests" });
    await env.DB.prepare("INSERT INTO interests (id, post_id, name, phone) VALUES ('i1', ?, 'Mehedi', '8801912345678')")
      .bind(post.id)
      .run();

    const res = await send("DELETE", `/posts/${post.id}`, undefined, { Authorization: `Bearer ${edit_token}` });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect((await send("GET", `/posts/${post.id}`)).status).toBe(404);
    const { results } = await env.DB.prepare("SELECT id FROM interests").all();
    expect(results).toHaveLength(0);
  });

  it("refuses a wrong or missing token, and 404s an unknown post", async () => {
    const { post } = await create();
    expect((await send("DELETE", `/posts/${post.id}`, undefined, { Authorization: "Bearer wrong" })).status).toBe(403);
    expect((await send("DELETE", `/posts/${post.id}`)).status).toBe(403);
    expect((await send("DELETE", "/posts/nope", undefined, { Authorization: "Bearer x" })).status).toBe(404);
    expect((await send("GET", `/posts/${post.id}`)).status).toBe(200);
  });
});
```

and in the existing `"answers preflight for PATCH"` test add:

```ts
    const del = await app.request(
      "/posts/x",
      { method: "OPTIONS", headers: { Origin: "http://localhost:5173", "Access-Control-Request-Method": "DELETE" } },
      env,
    );
    expect(del.headers.get("Access-Control-Allow-Methods")).toContain("DELETE");
```

- [ ] **Step 2: Run to verify failure** — `cd api && npx vitest run test/posts.test.ts` → FAIL (404 for DELETE route / missing DELETE in allow-methods).

- [ ] **Step 3: Implement** — `api/src/posts/repo.ts`:

```ts
/** Removes a post and every request sent to it. The edit token proves ownership. */
export async function deletePost(db: D1Database, id: string, token: string): Promise<"ok" | "not_found" | "forbidden"> {
  const owner = await db.prepare("SELECT edit_token FROM posts WHERE id = ?").bind(id).first<{ edit_token: string }>();
  if (!owner) return "not_found";
  if (!token || owner.edit_token !== token) return "forbidden";
  // Requests first, so this never depends on foreign-key cascades being on.
  await db.batch([
    db.prepare("DELETE FROM interests WHERE post_id = ?").bind(id),
    db.prepare("DELETE FROM posts WHERE id = ?").bind(id),
  ]);
  return "ok";
}
```

`api/src/app.ts`: import `deletePost` from `./posts/repo`; change `allowMethods: ["GET", "POST", "PATCH", "OPTIONS"]` to `["GET", "POST", "PATCH", "DELETE", "OPTIONS"]`; add after the PATCH route:

```ts
  // Host only: gone for good, with any requests.
  app.delete("/posts/:id", async (c) => {
    const token = c.req.header("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const outcome = await deletePost(c.env.DB, c.req.param("id"), token);
    if (outcome === "not_found") return c.json({ error: "not_found" }, 404);
    if (outcome === "forbidden") return c.json({ error: "forbidden" }, 403);
    return c.json({ ok: true });
  });
```

- [ ] **Step 4: Verify** — `cd api && npm test && npx tsc --noEmit` → all pass.

- [ ] **Step 5: Commit** — `git add api && git commit -m "feat(api): hosts can delete a post and its requests"`.

---

### Task 2: Transfer bundle (encode / decode / import)

**Files:**
- Create: `web/src/lib/transfer.ts`
- Modify: `web/src/lib/myPosts.ts` (add `forgetMyPost`, `mergeMyPosts`, `managePath` `fresh` flag)
- Test: `web/src/lib/transfer.test.ts`

**Interfaces:**
- Consumes: `loadKeeperProfile`, `saveKeeperProfile`, `KeeperProfile` (`lib/keeper.ts`); `loadTelegramKey`, `saveTelegramKey`, `TelegramKey` (`lib/alerts.ts`); `loadMyPosts`, `MyPost` (`lib/myPosts.ts`).
- Produces:
  - `type Bundle = { v: 1; keeper?: KeeperProfile; telegram?: TelegramKey; posts?: MyPost[] }`
  - `currentBundle(): Bundle`
  - `isEmpty(b: Bundle): boolean`
  - `encodeBundle(b: Bundle): string` (base64url of UTF-8 JSON)
  - `decodeBundle(data: string): Bundle | null` (null for anything malformed)
  - `moveUrl(b: Bundle, origin: string): string` → `${origin}/move#d=${encodeBundle(b)}`
  - `importBundle(b: Bundle): { keeper: boolean; telegram: boolean; posts: number }`
  - `myPosts.ts`: `forgetMyPost(id: string): void`, `mergeMyPosts(posts: MyPost[]): number` (returns how many were new), `managePath(id, token, fresh = false)` → adds `&new=1` when fresh.

- [ ] **Step 1: Failing tests** — `web/src/lib/transfer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loadTelegramKey } from "./alerts";
import { loadKeeperProfile, saveKeeperProfile } from "./keeper";
import { loadMyPosts, managePath, rememberMyPost } from "./myPosts";
import { type Bundle, currentBundle, decodeBundle, encodeBundle, importBundle, isEmpty, moveUrl } from "./transfer";

const keeper = { name: "মেহেদী Mehedi", phone: "8801912345678", regions: ["dhaka", "div-sylhet"], note: "" };

describe("transfer bundle", () => {
  it("round-trips everything this phone knows, including Bangla text", () => {
    saveKeeperProfile(keeper);
    rememberMyPost({ id: "p1", token: "tok-1" });
    window.localStorage.setItem("khelbinaki.telegram.v1", JSON.stringify({ code: "abc", link: "https://t.me/x?start=abc" }));

    const bundle = currentBundle();
    expect(bundle).toEqual({ v: 1, keeper, telegram: { code: "abc", link: "https://t.me/x?start=abc" }, posts: [{ id: "p1", token: "tok-1" }] });
    expect(decodeBundle(encodeBundle(bundle))).toEqual(bundle);
    expect(moveUrl(bundle, "https://k.example")).toMatch(/^https:\/\/k\.example\/move#d=[A-Za-z0-9_-]+$/);
  });

  it("rejects junk, truncated and wrong-version links", () => {
    const good = encodeBundle({ v: 1, posts: [{ id: "p1", token: "t" }] });
    expect(decodeBundle("")).toBeNull();
    expect(decodeBundle("not base64 !!")).toBeNull();
    expect(decodeBundle(good.slice(0, good.length - 6))).toBeNull();
    expect(decodeBundle(encodeBundle({ v: 2 } as unknown as Bundle))).toBeNull();
    expect(decodeBundle(encodeBundle({ v: 1, posts: [{ id: 5 }] } as unknown as Bundle))).toBeNull();
  });

  it("imports into an empty phone and merges posts without duplicates", () => {
    rememberMyPost({ id: "p1", token: "tok-1" });
    const result = importBundle({ v: 1, keeper, telegram: { code: "c", link: "l" }, posts: [{ id: "p1", token: "tok-1" }, { id: "p2", token: "tok-2" }] });
    expect(result).toEqual({ keeper: true, telegram: true, posts: 1 });
    expect(loadKeeperProfile()).toEqual(keeper);
    expect(loadTelegramKey()).toEqual({ code: "c", link: "l" });
    expect(loadMyPosts().map((p) => p.id).sort()).toEqual(["p1", "p2"]);
  });

  it("knows when there is nothing to move", () => {
    expect(isEmpty(currentBundle())).toBe(true);
  });

  it("marks a fresh manage link", () => {
    expect(managePath("p1", "t")).toBe("/p/p1/manage#t=t");
    expect(managePath("p1", "t", true)).toBe("/p/p1/manage#t=t&new=1");
  });
});
```

- [ ] **Step 2: Verify failure** — `cd web && npx vitest run src/lib/transfer.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement** — `web/src/lib/myPosts.ts` (append; replace `managePath`):

```ts
export function forgetMyPost(id: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(loadMyPosts().filter((p) => p.id !== id)));
  } catch {
    // Storage blocked: nothing was remembered here anyway.
  }
}

/** Adds posts from another phone; returns how many were new here. */
export function mergeMyPosts(posts: MyPost[]): number {
  const mine = loadMyPosts();
  const known = new Set(mine.map((p) => p.id));
  const fresh = posts.filter((p) => !known.has(p.id));
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...fresh, ...mine].slice(0, 20)));
  } catch {
    return 0;
  }
  return fresh.length;
}

export function managePath(id: string, token: string, fresh = false): string {
  return `/p/${id}/manage#t=${token}${fresh ? "&new=1" : ""}`;
}
```

`web/src/lib/transfer.ts`:

```ts
import { type TelegramKey, loadTelegramKey, saveTelegramKey } from "./alerts";
import { type KeeperProfile, loadKeeperProfile, saveKeeperProfile } from "./keeper";
import { type MyPost, loadMyPosts, mergeMyPosts } from "./myPosts";

// "Use on another phone": everything this phone knows, packed after the # of a
// link. Browsers never send the part after # to a server, so nothing is stored
// online; whoever holds the link can manage these posts and alerts.
export type Bundle = { v: 1; keeper?: KeeperProfile; telegram?: TelegramKey; posts?: MyPost[] };

export function currentBundle(): Bundle {
  const bundle: Bundle = { v: 1 };
  const keeper = loadKeeperProfile();
  const telegram = loadTelegramKey();
  const posts = loadMyPosts();
  if (keeper) bundle.keeper = keeper;
  if (telegram) bundle.telegram = telegram;
  if (posts.length > 0) bundle.posts = posts;
  return bundle;
}

export const isEmpty = (b: Bundle) => !b.keeper && !b.telegram && !(b.posts && b.posts.length > 0);

export function encodeBundle(b: Bundle): string {
  const bytes = new TextEncoder().encode(JSON.stringify(b));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const isString = (v: unknown): v is string => typeof v === "string";

function valid(value: unknown): value is Bundle {
  if (typeof value !== "object" || value === null) return false;
  const b = value as Record<string, unknown>;
  if (b.v !== 1) return false;
  if (b.keeper !== undefined) {
    const k = b.keeper as Record<string, unknown>;
    if (!k || !isString(k.name) || !isString(k.phone) || !isString(k.note) || !Array.isArray(k.regions) || !k.regions.every(isString)) return false;
  }
  if (b.telegram !== undefined) {
    const t = b.telegram as Record<string, unknown>;
    if (!t || !isString(t.code) || !isString(t.link)) return false;
  }
  if (b.posts !== undefined) {
    if (!Array.isArray(b.posts)) return false;
    if (!b.posts.every((p) => p && isString((p as MyPost).id) && isString((p as MyPost).token))) return false;
  }
  return true;
}

export function decodeBundle(data: string): Bundle | null {
  try {
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    const json = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
    const parsed: unknown = JSON.parse(json);
    return valid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function moveUrl(b: Bundle, origin: string): string {
  return `${origin}/move#d=${encodeBundle(b)}`;
}

export function importBundle(b: Bundle): { keeper: boolean; telegram: boolean; posts: number } {
  const keeper = b.keeper ? saveKeeperProfile(b.keeper) : false;
  if (b.telegram) saveTelegramKey(b.telegram);
  return { keeper, telegram: Boolean(b.telegram), posts: b.posts ? mergeMyPosts(b.posts) : 0 };
}
```

Update `web/src/pages/NewPostPage.tsx`: `navigate(managePath(result.post.id, result.editToken, true));`

- [ ] **Step 4: Verify** — `cd web && npx vitest run src/lib/transfer.test.ts && npx tsc -b` → pass.

- [ ] **Step 5: Commit** — `git add web/src/lib web/src/pages/NewPostPage.tsx && git commit -m "feat(web): pack this phone's profile, alerts key and posts into a private link"`.

---

### Task 3: `/move` import page

**Files:**
- Create: `web/src/pages/MovePage.tsx`, `web/src/pages/MovePage.test.tsx`
- Modify: `web/src/App.tsx` (route `/move`)

**Interfaces:**
- Consumes: `decodeBundle`, `importBundle`, `Bundle` (Task 2); `loadKeeperProfile`; `regionName` (`lib/bd`).

- [ ] **Step 1: Failing tests** — `web/src/pages/MovePage.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { loadKeeperProfile, saveKeeperProfile } from "@/lib/keeper";
import { loadMyPosts } from "@/lib/myPosts";
import { encodeBundle } from "@/lib/transfer";
import { MovePage } from "./MovePage";

const keeper = { name: "Mehedi", phone: "8801912345678", regions: ["dhaka"], note: "" };
const open = (hash: string) => window.history.pushState(null, "", `/move${hash}`);

afterEach(() => window.history.pushState(null, "", "/"));

describe("MovePage", () => {
  it("shows what it will copy, copies on tap, and wipes the link from the address bar", () => {
    open(`#d=${encodeBundle({ v: 1, keeper, posts: [{ id: "p1", token: "t1" }] })}`);
    render(<MovePage />);
    expect(window.location.hash).toBe("");
    expect(screen.getByText(/mehedi/i)).toBeInTheDocument();
    expect(screen.getByText(/1 post/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /copy to this phone/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/copied/i);
    expect(loadKeeperProfile()).toEqual(keeper);
    expect(loadMyPosts()).toEqual([{ id: "p1", token: "t1" }]);
  });

  it("warns before replacing a different profile on this phone", () => {
    saveKeeperProfile({ ...keeper, name: "Rafi" });
    open(`#d=${encodeBundle({ v: 1, keeper })}`);
    render(<MovePage />);
    expect(screen.getByText(/replaces rafi's profile/i)).toBeInTheDocument();
    expect(loadKeeperProfile()?.name).toBe("Rafi");
  });

  it("says when the link is broken", () => {
    open("#d=abc");
    render(<MovePage />);
    expect(screen.getByRole("heading", { name: /link doesn't work/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /copy to this phone/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Verify failure** — `npx vitest run src/pages/MovePage.test.tsx` → FAIL.

- [ ] **Step 3: Implement** — `web/src/pages/MovePage.tsx`:

```tsx
import { useState } from "react";
import { regionName } from "@/lib/bd";
import { loadKeeperProfile } from "@/lib/keeper";
import { Link } from "@/lib/router";
import { type Bundle, decodeBundle, importBundle } from "@/lib/transfer";
import { btn } from "@/lib/ui";

// Read once, then wipe the private data from the address bar and history entry.
function readBundle(): Bundle | null {
  const match = /(?:^|[#&])d=([A-Za-z0-9_-]+)/.exec(window.location.hash);
  const bundle = match ? decodeBundle(match[1]) : null;
  window.history.replaceState(null, "", window.location.pathname);
  return bundle;
}

export function MovePage() {
  const [bundle] = useState(readBundle);
  const [existing] = useState(loadKeeperProfile);
  const [done, setDone] = useState<ReturnType<typeof importBundle> | null>(null);

  if (!bundle) {
    return (
      <div className="mx-auto w-full max-w-xl px-5 pt-12 pb-24 md:px-10">
        <h1 className="font-display text-5xl leading-[0.9] font-extrabold uppercase">This link doesn't work</h1>
        <p className="mt-4 text-muted-foreground">
          It may have been cut short when it was sent. On your other phone, open Khelbi Naki and copy the "Use on
          another phone" link again.
        </p>
        <Link to="/" className="link-draw mt-6 inline-block font-semibold text-primary">
          Back to the boards
        </Link>
      </div>
    );
  }

  const posts = bundle.posts?.length ?? 0;
  const replacing = bundle.keeper && existing && existing.name !== bundle.keeper.name;
  const places = bundle.keeper?.regions.map((slug) => regionName(slug) ?? slug).join(", ");

  return (
    <div className="mx-auto w-full max-w-xl px-5 pt-12 pb-24 md:px-10">
      <p className="eyebrow text-primary">Use on this phone</p>
      <h1 className="mt-3.5 font-display text-6xl leading-[0.88] font-extrabold uppercase">Copy to this phone</h1>
      <p className="mt-4 text-muted-foreground">This link carries what was saved on your other phone:</p>
      <ul className="mt-5 flex flex-col divide-y rounded-2xl border border-[#242a1f] bg-card">
        {bundle.keeper && (
          <li className="p-4">
            <p className="font-semibold">Keeper profile: {bundle.keeper.name}</p>
            {places && <p className="mt-1 text-sm text-muted-foreground">{places}</p>}
            {replacing && (
              <p className="mt-2 text-sm text-destructive">This replaces {existing.name}'s profile on this phone.</p>
            )}
          </li>
        )}
        {bundle.telegram && <li className="p-4 font-semibold">Telegram alerts (control from this phone too)</li>}
        {posts > 0 && (
          <li className="p-4 font-semibold">
            {posts} {posts === 1 ? "post" : "posts"} you can manage
          </li>
        )}
      </ul>
      {done ? (
        <div className="mt-6">
          <p role="status" className="font-semibold text-primary">
            Copied. This phone now has everything.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {done.keeper && (
              <Link to="/keeper" className={btn.outline}>
                Keeper profile
              </Link>
            )}
            {posts > 0 && (
              <Link to="/my-posts" className={btn.outline}>
                My posts
              </Link>
            )}
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setDone(importBundle(bundle))} className={`${btn.primary} mt-6 w-full`}>
          Copy to this phone
        </button>
      )}
    </div>
  );
}
```

`web/src/App.tsx`: import `MovePage`; add `else if (path === "/move") page = <MovePage />;` before the `/new` branch.

- [ ] **Step 4: Verify** — `npx vitest run src/pages/MovePage.test.tsx && npx tsc -b` → pass.

- [ ] **Step 5: Commit** — `git commit -am "feat(web): /move copies another phone's profile, alerts key and posts"` (add new files first).

---

### Task 4: Manage page — save-your-link banner, delete, remember on this phone

**Files:**
- Create: `web/src/components/MoveLink.tsx`
- Modify: `web/src/lib/api.ts` (add `deletePost`), `web/src/pages/ManagePage.tsx`
- Test: `web/src/pages/ManagePage.test.tsx`

**Interfaces:**
- Consumes: `forgetMyPost`, `rememberMyPost`, `tokenForPost` (Task 2 / existing); `currentBundle`, `moveUrl`, `isEmpty` (Task 2).
- Produces: `deletePost(id: string, token: string): Promise<"deleted" | "gone">` (throws on other failures); `<MoveLink />` (no props).

- [ ] **Step 1: Failing tests** — add to `ManagePage.test.tsx` (extend `serve` so `DELETE` returns `deleteStatus`, default 200):

```ts
// in serve(): if (init?.method === "DELETE") return new Response(JSON.stringify({ ok: true }), { status: overrides.deleteStatus ?? 200 });
// and add `deleteStatus?: number` to the overrides type.

describe("owning a post without an account", () => {
  it("asks to save the manage link right after posting", async () => {
    serve();
    window.history.pushState(null, "", "/p/p1/manage#t=secret-token&new=1");
    render(<ManagePage id="p1" />);
    const banner = within(await screen.findByRole("region", { name: /save this page's link/i }));
    expect(banner.getByRole("link", { name: /send to my whatsapp/i }).getAttribute("href")).toMatch(/^https:\/\/wa\.me\/\?text=.*manage/);
  });

  it("remembers a manage link opened on a new phone", async () => {
    serve();
    window.history.pushState(null, "", "/p/p1/manage#t=secret-token");
    render(<ManagePage id="p1" />);
    await screen.findByRole("heading", { level: 1 });
    expect(loadMyPosts()).toEqual([{ id: "p1", token: "secret-token" }]);
  });

  it("deletes after confirming, and forgets the post", async () => {
    const calls = serve();
    window.history.pushState(null, "", "/p/p1/manage#t=secret-token");
    render(<ManagePage id="p1" />);
    fireEvent.click(await screen.findByRole("button", { name: /^delete post$/i }));
    expect(screen.getByText(/also removes 1 request/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /yes, delete/i }));
    expect(await screen.findByRole("heading", { name: /deleted/i })).toBeInTheDocument();
    const del = calls.find((c) => c.init?.method === "DELETE");
    expect((del?.init?.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
    expect(loadMyPosts()).toEqual([]);
  });

  it("treats a post the cleanup already removed as deleted", async () => {
    serve({ deleteStatus: 404 });
    window.history.pushState(null, "", "/p/p1/manage#t=secret-token");
    render(<ManagePage id="p1" />);
    fireEvent.click(await screen.findByRole("button", { name: /^delete post$/i }));
    fireEvent.click(screen.getByRole("button", { name: /yes, delete/i }));
    expect(await screen.findByRole("heading", { name: /deleted/i })).toBeInTheDocument();
  });
});
```

(import `loadMyPosts` from `@/lib/myPosts`.)

- [ ] **Step 2: Verify failure** — `npx vitest run src/pages/ManagePage.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`web/src/lib/api.ts`:

```ts
/** Host-only. "gone" when the post was already deleted (by the host or the cleanup). */
export async function deletePost(id: string, editToken: string): Promise<"deleted" | "gone"> {
  const res = await fetch(`${API_URL}/posts/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${editToken}` },
  });
  if (res.status === 404) return "gone";
  if (!res.ok) throw new Error(`Delete failed (${res.status})`);
  return "deleted";
}
```

`web/src/components/MoveLink.tsx`:

```tsx
import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";
import { canUseShareSheet } from "@/lib/share";
import { currentBundle, isEmpty, moveUrl } from "@/lib/transfer";
import { btn } from "@/lib/ui";

/** "Use on another phone": one private link that copies this phone's profile, alerts key and posts. */
export function MoveLink() {
  const [copied, setCopied] = useState(false);
  const bundle = currentBundle();
  if (isEmpty(bundle)) return null;
  // Built on tap, so it always carries the latest profile and posts.
  const link = () => moveUrl(currentBundle(), window.location.origin);

  return (
    <section aria-labelledby="move-heading" className="mt-10 rounded-2xl border border-dashed border-line p-4.5">
      <h2 id="move-heading" className="font-semibold">
        Use on another phone
      </h2>
      <p className="mt-1.5 text-sm leading-snug text-muted-foreground">
        Everything here is saved on this phone only. Open this link on your other phone to copy your profile, alerts and
        posts there. <span className="text-foreground">It's private, like a password</span> — send it only to yourself.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link());
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              setCopied(false);
            }
          }}
          className={btn.outline}
        >
          {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
          {copied ? "Copied" : "Copy link"}
        </button>
        {canUseShareSheet() ? (
          <button
            type="button"
            onClick={() => navigator.share({ title: "Khelbi Naki — my phone link", url: link() }).catch(() => undefined)}
            className={btn.outline}
          >
            <Share2 aria-hidden="true" className="size-4" /> Send to myself
          </button>
        ) : (
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`My Khelbi Naki link (private): ${link()}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={btn.outline}
          >
            <Share2 aria-hidden="true" className="size-4" /> Send to my WhatsApp
          </a>
        )}
      </div>
    </section>
  );
}
```

`web/src/pages/ManagePage.tsx`:
- `ManagePage`: after computing `token`, remember it on this phone:

```tsx
  // A manage link opened on a new phone: remember it here too, for My posts.
  useEffect(() => {
    if (token && tokenFromHash()) rememberMyPost({ id, token });
  }, [id, token]);
  const [fresh] = useState(() => /(?:^|[#&])new=1/.test(window.location.hash));
```

  and pass `fresh` to `ManageView`.
- `ManageView` gains `fresh: boolean` and state `const [deleteStep, setDeleteStep] = useState<"idle" | "confirm" | "busy" | "done" | "failed">("idle")`; `manageUrl = \`${origin}/p/${post.id}/manage#t=${token}\``.
- Render, when `deleteStep === "done"`, instead of everything else:

```tsx
      <section className="py-6">
        <h1 className="font-display text-6xl leading-[0.9] font-extrabold uppercase">Deleted</h1>
        <p className="mt-3 text-muted-foreground">The post and any requests sent to it are gone for good.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/my-posts" className={btn.outline}>My posts</Link>
          <Link to={board.newPath} className={btn.outline}>{board.postCta}</Link>
        </div>
      </section>
```

- When `fresh`, above the share card:

```tsx
      <section aria-labelledby="save-heading" className="mt-8 rounded-3xl border-2 border-primary p-5 md:p-6">
        <h2 id="save-heading" className="font-display text-[30px] leading-none font-extrabold uppercase">
          Save this page's link
        </h2>
        <p className="mt-2 text-[15px] leading-snug text-muted-foreground">
          It's the only way to mark this post filled or delete it — there's no account to log back into. Send it to
          yourself now.
        </p>
        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`My Khelbi Naki manage link (private): ${manageUrl}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(btn.primary, "h-13 text-base")}
          >
            Send to my WhatsApp
          </a>
          <button type="button" onClick={() => copy(manageUrl, "manage")} className={cn(btn.outline, "h-13")}>
            <Copy aria-hidden="true" className="size-4" /> {copied === "manage" ? "Copied" : "Copy link"}
          </button>
        </div>
      </section>
```

- Key section text becomes: "Anyone with it can manage this post. Share the post link with players — never this one." and uses `manageUrl`.
- After the key section: `<MoveLink />`, then the delete block:

```tsx
      <section aria-labelledby="delete-heading" className="mt-10 border-t pt-6">
        <h2 id="delete-heading" className="eyebrow text-subtle">Delete</h2>
        {deleteStep === "confirm" || deleteStep === "busy" ? (
          <div className="mt-3 rounded-2xl border border-destructive/60 p-4">
            <p className="font-semibold">Delete for good?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {interests.length > 0
                ? `This also removes ${interests.length} ${interests.length === 1 ? "request" : "requests"} sent to it.`
                : "It disappears from the board and its link stops working."}
            </p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={remove} disabled={deleteStep === "busy"} className={cn(btn.outline, "border-destructive text-destructive hover:border-destructive hover:text-destructive disabled:opacity-60")}>
                Yes, delete
              </button>
              <button type="button" onClick={() => setDeleteStep("idle")} className={btn.outline}>Keep it</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setDeleteStep("confirm")} className={cn(btn.outline, "mt-3 hover:border-destructive hover:text-destructive")}>
            Delete post
          </button>
        )}
        {deleteStep === "failed" && <p role="alert" className="mt-2 text-sm text-destructive">Couldn't delete. Check your connection and try again.</p>}
      </section>
```

  with

```tsx
  const remove = async () => {
    setDeleteStep("busy");
    try {
      await deletePost(post.id, token);
      forgetMyPost(post.id);
      setDeleteStep("done");
    } catch {
      setDeleteStep("failed");
    }
  };
```

  (the confirm text uses `interests.length`; for direct posts it's 0.) The "failed" state keeps the Delete post button visible so it can be tried again.

- [ ] **Step 4: Verify** — `npx vitest run src/pages/ManagePage.test.tsx && npx tsc -b` → pass.

- [ ] **Step 5: Commit** — `git add -A web/src && git commit -m "feat(web): hosts can delete posts and are asked to save their manage link"`.

---

### Task 5: My posts page

**Files:**
- Create: `web/src/pages/MyPostsPage.tsx`, `web/src/pages/MyPostsPage.test.tsx`
- Modify: `web/src/App.tsx` (route `/my-posts`), `web/src/components/AppShell.tsx` (menu item + footer "More" link when this phone has posts)

**Interfaces:**
- Consumes: `loadMyPosts`, `forgetMyPost`, `managePath` (Task 2); `fetchPost` (existing, returns `null` on 404, throws otherwise); `listingOf` (`lib/listing`); `formatDay`, `formatTime`.

- [ ] **Step 1: Failing tests** — `web/src/pages/MyPostsPage.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadMyPosts, rememberMyPost } from "@/lib/myPosts";
import { MyPostsPage } from "./MyPostsPage";

const post = (id: string) => ({
  id, listing_type: "gk_needed", team_name: null, players_per_side: 5, contact_mode: "direct", host_name: "Rafi",
  area: "Mirpur", district: "dhaka", division: "div-dhaka", turf_name: null,
  start_datetime: "2026-10-01T13:30:00.000Z", duration_minutes: 60, cost_per_head: 150, slots_needed: 1,
  notes: null, status: "open", created_at: "2026-10-01 08:00:00",
});

afterEach(() => vi.unstubAllGlobals());

describe("MyPostsPage", () => {
  it("lists this phone's posts, marks cleared ones and keeps posts it couldn't load", async () => {
    rememberMyPost({ id: "gone", token: "t3" });
    rememberMyPost({ id: "down", token: "t2" });
    rememberMyPost({ id: "live", token: "t1" });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.endsWith("/live")) return new Response(JSON.stringify({ post: post("live") }));
      if (url.endsWith("/gone")) return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
      return new Response("{}", { status: 500 });
    }));
    render(<MyPostsPage />);

    const live = (await screen.findByText("Mirpur")).closest("li") as HTMLElement;
    expect(within(live).getByRole("link", { name: /manage/i })).toHaveAttribute("href", "/p/live/manage#t=t1");
    expect(await screen.findByText(/cleared/i)).toBeInTheDocument();
    expect(await screen.findByText(/couldn't load/i)).toBeInTheDocument();
    expect(loadMyPosts().map((p) => p.id).sort()).toEqual(["down", "live"]);
  });

  it("explains when this phone has no posts", () => {
    render(<MyPostsPage />);
    expect(screen.getByText(/no posts on this phone/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Verify failure** — `npx vitest run src/pages/MyPostsPage.test.tsx` → FAIL.

- [ ] **Step 3: Implement** — `web/src/pages/MyPostsPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import { MoveLink } from "@/components/MoveLink";
import { type PublicPost, fetchPost } from "@/lib/api";
import { LISTINGS, isOpponent, listingOf } from "@/lib/listing";
import { type MyPost, forgetMyPost, loadMyPosts, managePath } from "@/lib/myPosts";
import { Link } from "@/lib/router";
import { formatDay, formatTime } from "@/lib/time";
import { btn } from "@/lib/ui";

type Row = MyPost & { state: "loading" | "failed" | "cleared" | { post: PublicPost } };

export function MyPostsPage() {
  const [rows, setRows] = useState<Row[]>(() => loadMyPosts().map((p) => ({ ...p, state: "loading" as const })));

  useEffect(() => {
    const controller = new AbortController();
    for (const mine of loadMyPosts()) {
      fetchPost(mine.id, controller.signal).then(
        (post) => {
          // 404: it ended and was cleaned up, or was deleted. Only then forget it.
          if (!post) forgetMyPost(mine.id);
          setRows((all) => all.map((r) => (r.id === mine.id ? { ...r, state: post ? { post } : "cleared" } : r)));
        },
        () => {
          if (!controller.signal.aborted) setRows((all) => all.map((r) => (r.id === mine.id ? { ...r, state: "failed" } : r)));
        },
      );
    }
    return () => controller.abort();
  }, []);

  return (
    <div className="mx-auto w-full max-w-2xl px-5 pt-10 pb-24 md:px-10">
      <p className="eyebrow text-primary">Saved on this phone</p>
      <h1 className="mt-3.5 font-display text-6xl leading-[0.88] font-extrabold uppercase">My posts</h1>
      <p className="mt-3 text-muted-foreground">
        Posts made on this phone (or copied to it). Posts are cleared two days after their match.
      </p>

      {rows.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-line p-6 text-muted-foreground">
          <p>No posts on this phone.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to={LISTINGS.gk_needed.newPath} className={btn.outline}>{LISTINGS.gk_needed.postCta}</Link>
            <Link to={LISTINGS.opponent_needed.newPath} className={btn.outline}>{LISTINGS.opponent_needed.postCta}</Link>
          </div>
        </div>
      ) : (
        <ul className="mt-8 border-b">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-4 border-t py-5">
              {typeof row.state === "object" ? (
                <>
                  <div className="min-w-0">
                    <p className="eyebrow text-subtle">
                      {listingOf(row.state.post).board} · {formatDay(new Date(row.state.post.start_datetime))} ·{" "}
                      {row.state.post.status === "filled" ? listingOf(row.state.post).filledBadge : row.state.post.status === "archived" ? "Ended" : "Open"}
                    </p>
                    <p className="mt-1.5 truncate text-lg font-semibold">
                      {isOpponent(row.state.post) ? (row.state.post.team_name ?? row.state.post.area) : row.state.post.area}
                    </p>
                    <p className="text-sm text-muted-foreground">{formatTime(new Date(row.state.post.start_datetime))}</p>
                  </div>
                  <Link to={managePath(row.id, row.token)} className={btn.outline}>Manage</Link>
                </>
              ) : (
                <p className="text-muted-foreground">
                  {row.state === "loading" ? "Loading…" : row.state === "cleared" ? "Cleared — its match ended, or it was deleted." : "Couldn't load this one. Check your connection."}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <MoveLink />
    </div>
  );
}
```

`App.tsx`: `else if (path === "/my-posts") page = <MyPostsPage />;`.

`AppShell.tsx`: read `const hasPosts = loadMyPosts().length > 0;` (re-evaluated on each render; path changes re-render). Add to the mobile menu list, after the keeper item: `...(hasPosts ? [{ to: "/my-posts", label: "My posts", hint: "Posts made on this phone" }] : [])`; add to the desktop nav after the profile link: `{hasPosts && <Link to="/my-posts" className="link-draw pb-0.5 hover:text-foreground">My posts</Link>}`; add to the footer "More" column links: `{ to: "/my-posts", label: "My posts" }` (always — the page explains when empty).

- [ ] **Step 4: Verify** — `npx vitest run && npx tsc -b` → pass (App tests still pass: the header has no posts in a fresh test).

- [ ] **Step 5: Commit** — `git add -A web/src && git commit -m "feat(web): My posts lists this phone's posts"`.

---

### Task 6: Keeper page — device notice, move link, delete turns alerts off; post-form warning; docs

**Files:**
- Modify: `web/src/pages/KeeperPage.tsx`, `web/src/pages/KeeperPage.test.tsx`, `web/src/pages/NewPostPage.tsx`, `CLAUDE.md`

**Interfaces:**
- Consumes: `disablePush`, `loadTelegramKey`, `saveTelegramKey`, `telegramOff` (`lib/alerts`); `<MoveLink />` (Task 4).

- [ ] **Step 1: Failing test** — add to `KeeperPage.test.tsx`:

```tsx
  it("turns this phone's Telegram alerts off when the profile is deleted", async () => {
    saveKeeperProfile({ name: "Mehedi", phone: "", regions: ["dhaka"], note: "" });
    window.localStorage.setItem("khelbinaki.telegram.v1", JSON.stringify({ code: "abc", link: "l" }));
    const fn = vi.fn(async () => new Response(JSON.stringify({ ok: true, status: "linked", regions: "dhaka" })));
    vi.stubGlobal("fetch", fn);
    render(<KeeperPage />);

    fireEvent.click(screen.getByRole("button", { name: /delete profile/i }));
    expect(screen.getByRole("checkbox", { name: /also turn off alerts/i })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: /yes, delete/i }));

    await waitFor(() => expect(fn.mock.calls.some(([url]) => String(url).endsWith("/alerts/telegram/abc/off"))).toBe(true));
    expect(loadKeeperProfile()).toBeNull();
    expect(window.localStorage.getItem("khelbinaki.telegram.v1")).toBeNull();
    vi.unstubAllGlobals();
  });
```

Update the existing "prefills a saved profile and deletes it" test to click **Delete profile**, then **Yes, delete** (with the checkbox unticked via `fireEvent.click(screen.getByRole("checkbox", …))` so no fetch is needed).

- [ ] **Step 2: Verify failure** — `npx vitest run src/pages/KeeperPage.test.tsx` → FAIL.

- [ ] **Step 3: Implement** — `KeeperPage.tsx`:
  - intro paragraph gains: `<span className="text-foreground">Saved on this phone only</span> — moving phones? Use "Use on another phone" below.`
  - state `const [confirmDelete, setConfirmDelete] = useState(false); const [alertsOff, setAlertsOff] = useState(true);`
  - `Delete profile` button now `onClick={() => setConfirmDelete(true)}`; when `confirmDelete`, render:

```tsx
            <div className="rounded-2xl border border-destructive/60 p-4">
              <p className="font-semibold">Delete your keeper profile from this phone?</p>
              <label className="mt-3 flex items-center gap-2.5 text-sm">
                <input type="checkbox" checked={alertsOff} onChange={(e) => setAlertsOff(e.target.checked)} className="size-4 accent-primary" />
                Also turn off alerts on this phone
              </label>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={onDelete} className="rounded-full border border-destructive px-5 py-2.5 font-semibold text-destructive">Yes, delete</button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-full border px-5 py-2.5 font-semibold">Keep it</button>
              </div>
            </div>
```

  - `onDelete` becomes async: if `alertsOff`, `await disablePush().catch(() => undefined)`; `const key = loadTelegramKey(); if (key) { await telegramOff(key.code); saveTelegramKey(null); }`; then the existing clearing, plus `setConfirmDelete(false)` and `window.dispatchEvent(new Event(ALERTS_CHANGED))`.
  - render `<MoveLink />` after `<AlertSettings … />`.
- `NewPostPage.tsx`: above the submit button:

```tsx
            <p className="text-[13px] leading-relaxed text-subtle">
              After posting you get a private manage link — the only way to mark this post filled or delete it. Keep it.
            </p>
```

- `CLAUDE.md`: API table row `| DELETE /posts/:id | Authorization: Bearer <edit_token> | 200 {ok} (post + its interests gone) | 403, 404 |`; under Key behaviors add: "8. **Devices** (spec 2026-09-23): no accounts — `/move#d=…` carries keeper profile, Telegram key and manage links in the URL fragment (never stored server-side); `/my-posts` lists this phone's posts; hosts can delete (`DELETE /posts/:id`)."

- [ ] **Step 4: Verify** — `cd web && npm test && npx tsc -b && npm run build`; `cd api && npm test`.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: keeper device notice, move link, delete profile turns alerts off"`.
