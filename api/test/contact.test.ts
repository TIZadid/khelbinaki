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
  district: "dhaka",
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
      "INSERT INTO posts (id, host_name, phone, area, district, division, start_datetime, edit_token) VALUES ('started001', 'X', '8801711111111', 'Mirpur', 'dhaka', 'div-dhaka', '2026-10-01T09:00:00.000Z', 't')",
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
