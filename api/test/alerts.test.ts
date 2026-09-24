import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { alertMessage, notifyNewPost } from "../src/alerts/notify";
import { listAlertsFor, normalizeRegions, wantsRegion } from "../src/alerts/repo";
import { buildVapidJwt, sendPush } from "../src/lib/webpush";
import { createApp } from "../src/app";
import type { PublicPost } from "../src/posts/repo";

const NOW = new Date("2026-10-01T10:00:00.000Z");
const app = createApp({ verifyHuman: () => async () => true, now: () => NOW });
const bot = createApp({ verifyHuman: () => async () => false, now: () => NOW });

const post: PublicPost = {
  id: "abc123",
  listing_type: "gk_needed",
  team_name: null,
  players_per_side: 5,
  contact_mode: "direct",
  host_name: "Rafi",
  area: "Mirpur",
  district: "dhaka",
  division: "div-dhaka",
  turf_name: "Kings Arena",
  start_datetime: "2026-10-01T13:30:00.000Z",
  duration_minutes: 60,
  cost_per_head: 150,
  slots_needed: 1,
  notes: null,
  status: "open",
  created_at: "2026-10-01 08:00:00",
};

function send(a: typeof app, method: string, path: string, body?: unknown) {
  return a.request(
    path,
    { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) },
    env,
  );
}

const PUSH_ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc";

afterEach(() => vi.restoreAllMocks());

beforeEach(async () => {
  // Bot replies go to api.telegram.org; never let a test reach the real thing.
  const realFetch = globalThis.fetch;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) =>
    String(input).startsWith("https://api.telegram.org/") ? new Response("{}") : realFetch(input, init),
  );
  await env.DB.prepare("DELETE FROM alerts").run();
  await env.DB.prepare("DELETE FROM telegram_links").run();
});

describe("regions", () => {
  it("keeps known districts and divisions, drops the rest", () => {
    expect(normalizeRegions([" Dhaka ", "DHAKA", "sylhet", "atlantis", "coxs-bazar"])).toBe("dhaka,sylhet,coxs-bazar");
  });

  it("an empty list means anywhere, and a division covers its districts", () => {
    expect(wantsRegion("", "coxs-bazar", "div-chattogram")).toBe(true);
    expect(wantsRegion("div-chattogram", "coxs-bazar", "div-chattogram")).toBe(true);
    expect(wantsRegion("coxs-bazar", "coxs-bazar", "div-chattogram")).toBe(true);
    expect(wantsRegion("sylhet", "coxs-bazar", "div-chattogram")).toBe(false);
  });
});

describe("POST /alerts", () => {
  it("remembers a push subscription and its areas", async () => {
    const res = await send(app, "POST", "/alerts", {
      subscription: { endpoint: PUSH_ENDPOINT },
      regions: ["dhaka", "sylhet"],
      turnstile_token: "tok",
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, regions: "dhaka,sylhet", boards: "gk_needed" });

    expect(await listAlertsFor(env.DB, "dhaka", "div-dhaka")).toHaveLength(1);
    expect(await listAlertsFor(env.DB, "sylhet", "div-sylhet")).toHaveLength(1);
    expect(await listAlertsFor(env.DB, "khulna", "div-khulna")).toHaveLength(0);
  });

  it("updates the areas when the same browser subscribes again", async () => {
    await send(app, "POST", "/alerts", { subscription: { endpoint: PUSH_ENDPOINT }, regions: ["dhaka"], turnstile_token: "t" });
    await send(app, "POST", "/alerts", { subscription: { endpoint: PUSH_ENDPOINT }, regions: ["khulna"], turnstile_token: "t" });

    expect(await listAlertsFor(env.DB, "dhaka", "div-dhaka")).toHaveLength(0);
    expect(await listAlertsFor(env.DB, "khulna", "div-khulna")).toHaveLength(1);
  });

  it("moves a browser's alerts to new places without another spam check", async () => {
    await send(app, "POST", "/alerts", { subscription: { endpoint: PUSH_ENDPOINT }, regions: ["dhaka"], turnstile_token: "t" });
    const res = await send(bot, "POST", "/alerts/regions", { endpoint: PUSH_ENDPOINT, regions: ["div-sylhet"] });
    expect(await res.json()).toEqual({ ok: true, regions: "div-sylhet" });
    expect(await listAlertsFor(env.DB, "sylhet", "div-sylhet")).toHaveLength(1);
    expect((await send(app, "POST", "/alerts/regions", { endpoint: "https://x.example/unknown", regions: [] })).status).toBe(404);
  });

  it("refuses bots and junk", async () => {
    expect((await send(bot, "POST", "/alerts", { subscription: { endpoint: PUSH_ENDPOINT }, turnstile_token: "t" })).status).toBe(403);
    const bad = await send(app, "POST", "/alerts", { subscription: { endpoint: "not-a-url" }, turnstile_token: "t" });
    expect(bad.status).toBe(400);
  });

  it("remembers which boards a browser wants, and refuses none", async () => {
    await send(app, "POST", "/alerts", { subscription: { endpoint: PUSH_ENDPOINT }, boards: ["opponent_needed", "nope"], turnstile_token: "t" });
    expect(await listAlertsFor(env.DB, "dhaka", "div-dhaka", "opponent_needed")).toHaveLength(1);
    expect(await listAlertsFor(env.DB, "dhaka", "div-dhaka", "gk_needed")).toHaveLength(0);

    await send(app, "POST", "/alerts/regions", { endpoint: PUSH_ENDPOINT, regions: [], boards: ["gk_needed", "opponent_needed"] });
    expect(await listAlertsFor(env.DB, "dhaka", "div-dhaka", "gk_needed")).toHaveLength(1);

    const none = await send(app, "POST", "/alerts", { subscription: { endpoint: PUSH_ENDPOINT }, boards: [], turnstile_token: "t" });
    expect(none.status).toBe(400);
  });

  it("forgets a subscription on request", async () => {
    await send(app, "POST", "/alerts", { subscription: { endpoint: PUSH_ENDPOINT }, turnstile_token: "t" });
    expect(await (await send(app, "POST", "/alerts/off", { endpoint: PUSH_ENDPOINT })).json()).toEqual({ ok: true });
    expect(await listAlertsFor(env.DB, "dhaka", "div-dhaka")).toHaveLength(0);
  });
});

describe("Telegram linking", () => {
  it("hands out a one-use code, then ties the chat to those areas", async () => {
    const withBot = { ...env, TELEGRAM_BOT_USERNAME: "khelbinaki_bot", TELEGRAM_BOT_TOKEN: "gk-tok", TELEGRAM_WEBHOOK_SECRET: "hook-secret" };

    const codeRes = await app.request(
      "/alerts/telegram",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ regions: ["dhaka"], turnstile_token: "t" }) },
      withBot,
    );
    expect(codeRes.status).toBe(201);
    const { code, link } = (await codeRes.json()) as { code: string; link: string };
    expect(link).toBe(`https://t.me/khelbinaki_bot?start=${code}`);

    const hook = (body: unknown, secret = "hook-secret") =>
      app.request(
        `/telegram/${secret}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
        withBot,
      );

    expect((await hook({ message: { chat: { id: 4242 }, text: `/start ${code}` } })).status).toBe(200);
    const alerts = await listAlertsFor(env.DB, "dhaka", "div-dhaka");
    expect(alerts).toMatchObject([{ channel: "telegram", address: "4242", regions: "dhaka" }]);

    // The code is spent, so a replay links nothing new.
    await hook({ message: { chat: { id: 9999 }, text: `/start ${code}` } });
    expect(await listAlertsFor(env.DB, "dhaka", "div-dhaka")).toHaveLength(1);

    await hook({ message: { chat: { id: 4242 }, text: "/stop" } });
    expect(await listAlertsFor(env.DB, "dhaka", "div-dhaka")).toHaveLength(0);
  });

  it("lets the browser holding the code check, re-place and stop its Telegram alerts", async () => {
    const withBot = { ...env, TELEGRAM_BOT_USERNAME: "khelbinaki_bot", TELEGRAM_BOT_TOKEN: "gk-tok", TELEGRAM_WEBHOOK_SECRET: "hook-secret" };
    const call = (method: string, path: string, body?: unknown) =>
      app.request(
        path,
        { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) },
        withBot,
      );

    const { code } = (await (await call("POST", "/alerts/telegram", { regions: ["dhaka"], turnstile_token: "t" })).json()) as {
      code: string;
    };
    expect(await (await call("GET", `/alerts/telegram/${code}`)).json()).toEqual({ status: "waiting", board: "gk_needed" });
    expect(await (await call("GET", "/alerts/telegram/nope")).json()).toEqual({ status: "unknown" });
    // Nothing to re-place until Start is tapped.
    expect((await call("POST", `/alerts/telegram/${code}/regions`, { regions: ["sylhet"] })).status).toBe(404);

    await call("POST", "/telegram/hook-secret", { message: { chat: { id: 4242 }, text: `/start ${code}` } });
    expect(await (await call("GET", `/alerts/telegram/${code}`)).json()).toEqual({ status: "linked", regions: "dhaka", board: "gk_needed" });

    const moved = await call("POST", `/alerts/telegram/${code}/regions`, { regions: ["sylhet", "div-khulna"] });
    expect(await moved.json()).toEqual({ ok: true, regions: "sylhet,div-khulna" });
    expect(await listAlertsFor(env.DB, "dhaka", "div-dhaka")).toHaveLength(0);
    expect(await listAlertsFor(env.DB, "sylhet", "div-sylhet")).toHaveLength(1);

    // The same chat can reuse its own link; it just re-links.
    await call("POST", "/telegram/hook-secret", { message: { chat: { id: 4242 }, text: `/start ${code}` } });
    expect(await listAlertsFor(env.DB, "sylhet", "div-sylhet")).toHaveLength(1);

    expect(await (await call("POST", `/alerts/telegram/${code}/off`)).json()).toEqual({ ok: true });
    expect(await (await call("GET", `/alerts/telegram/${code}`)).json()).toEqual({ status: "stopped", board: "gk_needed" });
  });

  it("answers /status and /places in the bot", async () => {
    const replies: string[] = [];
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      replies.push(JSON.parse(String(init?.body)).text);
      return new Response("{}");
    });
    const withBot = { ...env, TELEGRAM_BOT_TOKEN: "tok", TELEGRAM_WEBHOOK_SECRET: "hook-secret" };
    const hook = (text: string) =>
      app.request(
        "/telegram/hook-secret",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: { chat: { id: 7 }, text } }) },
        withBot,
      );

    await hook("/status");
    await env.DB.prepare("INSERT INTO alerts (id, channel, address, regions) VALUES ('a', 'telegram', '7', 'dhaka')").run();
    await hook("/status");
    await hook("/places");
    fetchSpy.mockRestore();

    expect(replies[0]).toMatch(/alerts are off/i);
    expect(replies[1]).toMatch(/watching Dhaka/);
    expect(replies[2]).toMatch(/\/alerts$/);
  });

  it("keeps the two bots apart: a GK link does nothing in the opponent bot", async () => {
    const withBots = {
      ...env,
      TELEGRAM_BOT_USERNAME: "gklagbebot",
      TELEGRAM_OPP_BOT_USERNAME: "opponentlagbebot",
      TELEGRAM_OPP_BOT_TOKEN: "opp-tok",
      TELEGRAM_WEBHOOK_SECRET: "hook-secret",
    };
    const call = (path: string, body: unknown) =>
      app.request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, withBots);

    const gk = (await (await call("/alerts/telegram", { regions: ["dhaka"], turnstile_token: "t" })).json()) as { code: string };
    const opp = (await (
      await call("/alerts/telegram", { regions: ["dhaka"], board: "opponent_needed", turnstile_token: "t" })
    ).json()) as { code: string; link: string; board: string };
    expect(opp.link).toBe(`https://t.me/opponentlagbebot?start=${opp.code}`);
    expect(opp.board).toBe("opponent_needed");

    await call("/telegram/opp/hook-secret", { message: { chat: { id: 55 }, text: `/start ${gk.code}` } });
    expect(await listAlertsFor(env.DB, "dhaka", "div-dhaka", "gk_needed")).toHaveLength(0);
    expect(await listAlertsFor(env.DB, "dhaka", "div-dhaka", "opponent_needed")).toHaveLength(0);

    await call("/telegram/opp/hook-secret", { message: { chat: { id: 55 }, text: `/start ${opp.code}` } });
    expect(await listAlertsFor(env.DB, "dhaka", "div-dhaka", "opponent_needed")).toMatchObject([
      { channel: "telegram_opp", address: "55", boards: "opponent_needed" },
    ]);
    expect(await listAlertsFor(env.DB, "dhaka", "div-dhaka", "gk_needed")).toHaveLength(0);
  });

  it("says so when a board's bot isn't set up, and the other still works", async () => {
    // The opponent bot has a username but no token yet: it can't answer, so no link.
    const onlyGk = {
      ...env,
      TELEGRAM_BOT_USERNAME: "gklagbebot",
      TELEGRAM_BOT_TOKEN: "gk-tok",
      TELEGRAM_OPP_BOT_USERNAME: "opponentlagbebot",
      TELEGRAM_OPP_BOT_TOKEN: "",
    };
    const ask = (board?: string) =>
      app.request(
        "/alerts/telegram",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ board, turnstile_token: "t" }) },
        onlyGk,
      );
    expect((await ask("opponent_needed")).status).toBe(503);
    expect((await ask()).status).toBe(201);
  });

  it("points both bots at their own webhooks", async () => {
    const urls: string[] = [];
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      urls.push(`${String(url)} ${JSON.parse(String(init?.body)).url}`);
      return new Response(JSON.stringify({ ok: true }));
    });
    const res = await app.request(
      "https://api.example/telegram/setup/hook-secret",
      { method: "POST" },
      { ...env, TELEGRAM_BOT_TOKEN: "gk-tok", TELEGRAM_OPP_BOT_TOKEN: "opp-tok", TELEGRAM_WEBHOOK_SECRET: "hook-secret" },
    );
    spy.mockRestore();
    expect(await res.json()).toEqual({ gk: { ok: true, description: null }, opp: { ok: true, description: null } });
    expect(urls).toEqual([
      "https://api.telegram.org/botgk-tok/setWebhook https://api.example/telegram/hook-secret",
      "https://api.telegram.org/botopp-tok/setWebhook https://api.example/telegram/opp/hook-secret",
    ]);
  });

  it("ignores calls without the secret path", async () => {
    const res = await app.request(
      "/telegram/wrong",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      { ...env, TELEGRAM_WEBHOOK_SECRET: "hook-secret" },
    );
    expect(res.status).toBe(403);
  });
});

describe("web push VAPID", () => {
  it("signs a token the push service can verify", async () => {
    const jwt = await buildVapidJwt("https://fcm.googleapis.com", "https://khelbinaki.example", env.VAPID_PRIVATE_KEY, NOW);
    const [header, claims, signature] = jwt.split(".");
    const decode = (part: string) => JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));

    expect(decode(header)).toEqual({ typ: "JWT", alg: "ES256" });
    expect(decode(claims)).toEqual({
      aud: "https://fcm.googleapis.com",
      exp: Math.floor(NOW.getTime() / 1000) + 12 * 60 * 60,
      sub: "https://khelbinaki.example",
    });

    const raw = Uint8Array.from(atob(env.VAPID_PUBLIC_KEY.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey("raw", raw, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const sig = Uint8Array.from(atob(signature.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const verified = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      sig,
      new TextEncoder().encode(`${header}.${claims}`),
    );
    expect(verified).toBe(true);
  });

  it("reports a dropped subscription", async () => {
    const gone = vi.fn(async () => new Response("", { status: 410 }));
    const keys = { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: "https://k.example" };
    expect(await sendPush(PUSH_ENDPOINT, keys, gone as unknown as typeof fetch)).toBe("gone");
  });
});

describe("notifyNewPost", () => {
  it("messages Telegram chats and pushes browsers watching the area", async () => {
    await send(app, "POST", "/alerts", { subscription: { endpoint: PUSH_ENDPOINT }, regions: ["dhaka"], turnstile_token: "t" });
    await env.DB.prepare("INSERT INTO alerts (id, channel, address, regions) VALUES ('t1', 'telegram', '4242', 'dhaka')").run();
    await env.DB.prepare("INSERT INTO alerts (id, channel, address, regions) VALUES ('t2', 'telegram', '777', 'khulna')").run();

    const calls: string[] = [];
    const fetcher = vi.fn(async (url: string) => {
      calls.push(url);
      return new Response("{}", { status: 200 });
    });

    const result = await notifyNewPost(
      {
        DB: env.DB,
        SITE_URL: "https://khelbinaki.example",
        VAPID_PUBLIC_KEY: env.VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY: env.VAPID_PRIVATE_KEY,
        TELEGRAM_BOT_TOKEN: "bot-token",
      },
      post,
      fetcher as unknown as typeof fetch,
    );

    expect(result.sent).toBe(2);
    expect(calls).toContain(PUSH_ENDPOINT);
    expect(calls.filter((c) => c.includes("api.telegram.org"))).toHaveLength(1);
  });

  it("sends an opponent post only to alerts that want Opponent Lagbe, through the opponent bot", async () => {
    await env.DB.prepare(
      `INSERT INTO alerts (id, channel, address, regions, boards) VALUES
        ('k', 'telegram', '4242', '', 'gk_needed'),
        ('t', 'telegram_opp', '777', '', 'opponent_needed'),
        ('p', 'push', 'https://push.example/both', '', 'gk_needed,opponent_needed')`,
    ).run();
    const calls: { url: string; body: string }[] = [];
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: String(init?.body ?? "") });
      return new Response("{}", { status: 200 });
    });
    const result = await notifyNewPost(
      {
        DB: env.DB,
        SITE_URL: "https://k.example",
        TELEGRAM_BOT_TOKEN: "gk-tok",
        TELEGRAM_OPP_BOT_TOKEN: "opp-tok",
        VAPID_PUBLIC_KEY: env.VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY: env.VAPID_PRIVATE_KEY,
      },
      { ...post, listing_type: "opponent_needed", team_name: "FC Mirpur", players_per_side: 6, cost_per_head: 1500 },
      fetcher as unknown as typeof fetch,
    );
    expect(result.sent).toBe(2);
    const telegram = calls.filter((c) => c.url.includes("api.telegram.org"));
    expect(telegram.map((c) => c.url)).toEqual(["https://api.telegram.org/botopp-tok/sendMessage"]);
    expect(JSON.parse(telegram[0].body).text).toMatch(/^Opponent needed: FC Mirpur · 6-a-side · .* · ৳1500\/team\nhttps:\/\/k\.example\/p\/abc123$/);
    expect(calls.some((c) => c.url === "https://push.example/both")).toBe(true);
  });

  it("forgets subscriptions the browser has dropped", async () => {
    await send(app, "POST", "/alerts", { subscription: { endpoint: PUSH_ENDPOINT }, turnstile_token: "t" });
    const fetcher = vi.fn(async () => new Response("", { status: 410 }));

    const result = await notifyNewPost(
      { DB: env.DB, SITE_URL: "https://k.example", VAPID_PUBLIC_KEY: env.VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY: env.VAPID_PRIVATE_KEY },
      post,
      fetcher as unknown as typeof fetch,
    );

    expect(result).toEqual({ sent: 0, dropped: 1 });
    expect(await listAlertsFor(env.DB, "dhaka", "div-dhaka")).toHaveLength(0);
  });

  it("writes a message with the place, time, price and link", () => {
    expect(alertMessage(post, "https://khelbinaki.example")).toBe(
      "Keeper needed: Kings Arena, Mirpur, Dhaka · Thu 1 Oct 7:30 PM · ৳150/head\nhttps://khelbinaki.example/p/abc123",
    );
  });
});
