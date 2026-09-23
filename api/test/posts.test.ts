import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";

const NOW = new Date("2026-10-01T10:00:00.000Z");
const app = createApp({ verifyHuman: () => async () => true, now: () => NOW });

// The test plugin keeps D1 data across tests in a file, so start each test empty.
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM interests").run();
  await env.DB.prepare("DELETE FROM posts").run();
});

const validBody = {
  host_name: "Rafi",
  phone: "01712345678",
  area: "Mirpur",
  district: "dhaka",
  turf_name: "Kings Arena",
  start_datetime: "2026-10-01T14:00:00.000Z",
  duration_minutes: 60,
  cost_per_head: 150,
  turnstile_token: "tok",
};

function send(method: string, path: string, body?: unknown, headers: Record<string, string> = {}, a = app) {
  return a.request(
    path,
    { method, headers: { "Content-Type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) },
    env,
  );
}

async function create(overrides: Record<string, unknown> = {}) {
  const res = await send("POST", "/posts", { ...validBody, ...overrides });
  expect(res.status).toBe(201);
  return (await res.json()) as { post: Record<string, unknown>; edit_token: string };
}

async function insertRaw(id: string, start: string, status = "open") {
  await env.DB.prepare(
    "INSERT INTO posts (id, host_name, phone, area, district, division, start_datetime, status, edit_token) VALUES (?, 'X', '8801711111111', 'Mirpur', 'dhaka', 'div-dhaka', ?, ?, 't')",
  )
    .bind(id, start, status)
    .run();
}

describe("POST /posts", () => {
  it("creates a post and returns the edit token once", async () => {
    const { post, edit_token } = await create();
    expect(post).toMatchObject({
      listing_type: "gk_needed",
      host_name: "Rafi",
      contact_mode: "direct",
      area: "Mirpur",
      district: "dhaka",
      division: "div-dhaka",
      turf_name: "Kings Arena",
      start_datetime: "2026-10-01T14:00:00.000Z",
      cost_per_head: 150,
      slots_needed: 1,
      status: "open",
    });
    expect(post.id).toMatch(/^[0-9A-Za-z]{10}$/);
    expect(post).not.toHaveProperty("edit_token");
    expect(post).not.toHaveProperty("phone");
    expect(edit_token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("returns field errors", async () => {
    const res = await send("POST", "/posts", { ...validBody, phone: "123" });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "validation", fields: { phone: expect.any(String) } });
  });

  it("rejects bad JSON", async () => {
    const res = await app.request("/posts", { method: "POST", body: "{", headers: { "Content-Type": "application/json" } }, env);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_json" });
  });

  it("rejects when the captcha fails, after validation passes", async () => {
    const bot = createApp({ verifyHuman: () => async () => false, now: () => NOW });
    expect((await send("POST", "/posts", validBody, {}, bot)).status).toBe(403);
    expect((await send("POST", "/posts", { ...validBody, turnstile_token: undefined })).status).toBe(403);
    const { results } = await env.DB.prepare("SELECT id FROM posts").all();
    expect(results).toHaveLength(0);
  });
});

describe("GET /posts (feed)", () => {
  it("lists only upcoming, non-archived posts, soonest first, without tokens", async () => {
    const later = await create({ start_datetime: "2026-10-02T14:00:00.000Z" });
    const sooner = await create({ start_datetime: "2026-10-01T12:00:00.000Z" });
    await insertRaw("past000001", "2026-10-01T09:59:59.000Z");
    await insertRaw("archived01", "2026-10-03T10:00:00.000Z", "archived");
    await insertRaw("filled0001", "2026-10-04T10:00:00.000Z", "filled");

    const res = await send("GET", "/posts");
    expect(res.status).toBe(200);
    const { posts } = (await res.json()) as { posts: Record<string, unknown>[] };
    expect(posts.map((p) => p.id)).toEqual([sooner.post.id, later.post.id, "filled0001"]);
    for (const p of posts) {
      expect(p).not.toHaveProperty("edit_token");
      expect(p).not.toHaveProperty("phone");
    }
  });

  it("keeps the two boards apart: keeper posts by default, opponents or both on request", async () => {
    const keeper = await create();
    const match = await create({ listing_type: "opponent_needed", team_name: "FC Mirpur", players_per_side: 6, start_datetime: "2026-10-01T15:00:00.000Z" });
    const ids = async (query: string) =>
      ((await (await send("GET", `/posts${query}`)).json()) as { posts: { id: string }[] }).posts.map((p) => p.id);

    expect(await ids("")).toEqual([keeper.post.id]);
    expect(await ids("?type=opponent_needed")).toEqual([match.post.id]);
    expect(await ids("?type=all")).toEqual([keeper.post.id, match.post.id]);
    expect((await send("GET", "/posts?type=nope")).status).toBe(400);
    expect(match.post).toMatchObject({ team_name: "FC Mirpur", players_per_side: 6, slots_needed: 1 });
  });

  it("filters by area, case-insensitively", async () => {
    await create({ area: "Mirpur" });
    await create({ area: "Agrabad" });
    const { posts } = (await (await send("GET", "/posts?area=agrabad")).json()) as { posts: { area: string }[] };
    expect(posts.map((p) => p.area)).toEqual(["Agrabad"]);
  });
});

describe("GET /posts/:id", () => {
  it("returns a post, or 404", async () => {
    const { post } = await create();
    const res = await send("GET", `/posts/${post.id}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ post });
    expect((await send("GET", "/posts/nope")).status).toBe(404);
  });
});

describe("PATCH /posts/:id", () => {
  it("marks filled and reopens with the right token", async () => {
    const { post, edit_token } = await create();
    const filled = await send("PATCH", `/posts/${post.id}`, { edit_token, status: "filled" });
    expect(filled.status).toBe(200);
    expect(await filled.json()).toMatchObject({ post: { id: post.id, status: "filled" } });
    const reopened = await send("PATCH", `/posts/${post.id}`, { edit_token, status: "open" });
    expect(await reopened.json()).toMatchObject({ post: { status: "open" } });
  });

  it("refuses a wrong token, unknown id, or bad status", async () => {
    const { post, edit_token } = await create();
    expect((await send("PATCH", `/posts/${post.id}`, { edit_token: "wrong", status: "filled" })).status).toBe(403);
    expect((await send("PATCH", "/posts/nope", { edit_token, status: "filled" })).status).toBe(404);
    expect((await send("PATCH", `/posts/${post.id}`, { edit_token, status: "archived" })).status).toBe(400);
    const { post: after } = (await (await send("GET", `/posts/${post.id}`)).json()) as { post: { status: string } };
    expect(after.status).toBe("open");
  });
});

describe("CORS", () => {
  it("allows the site and its previews, not other origins", async () => {
    const allowed = await send("GET", "/posts", undefined, { Origin: "https://khelbinaki.zlabz.workers.dev" });
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe("https://khelbinaki.zlabz.workers.dev");
    const preview = await send("GET", "/posts", undefined, { Origin: "https://ab12cd34-khelbinaki.zlabz.workers.dev" });
    expect(preview.headers.get("Access-Control-Allow-Origin")).toBe("https://ab12cd34-khelbinaki.zlabz.workers.dev");
    const other = await send("GET", "/posts", undefined, { Origin: "https://evil.example" });
    expect(other.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("answers preflight for PATCH", async () => {
    const res = await app.request(
      "/posts/x",
      { method: "OPTIONS", headers: { Origin: "http://localhost:5173", "Access-Control-Request-Method": "PATCH" } },
      env,
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("PATCH");
  });
});
