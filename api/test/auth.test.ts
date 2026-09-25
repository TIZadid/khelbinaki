import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { cleanup } from "../src/cleanup";

const NOW = new Date("2026-10-01T10:00:00.000Z");
const app = createApp({ verifyHuman: () => async () => true, now: () => NOW });
const withBots = {
  ...env,
  TELEGRAM_BOT_USERNAME: "gklagbebot",
  TELEGRAM_BOT_TOKEN: "gk-tok",
  TELEGRAM_OPP_BOT_USERNAME: "opponentlagbebot",
  TELEGRAM_OPP_BOT_TOKEN: "opp-tok",
  TELEGRAM_WEBHOOK_SECRET: "hook-secret",
};

const replies: { text: string; markup?: unknown }[] = [];

beforeEach(async () => {
  replies.length = 0;
  const realFetch = globalThis.fetch;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    if (String(input).startsWith("https://api.telegram.org/")) {
      const body = JSON.parse(String(init?.body));
      replies.push({ text: body.text, markup: body.reply_markup });
      return new Response("{}");
    }
    return realFetch(input, init);
  });
  for (const table of ["sessions", "login_codes", "accounts", "alerts", "telegram_links", "interests", "posts"]) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
});
afterEach(() => vi.restoreAllMocks());

function call(method: string, path: string, body?: unknown, session?: string) {
  return app.request(
    path,
    {
      method,
      headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    withBots,
  );
}

const USER = { id: 424242, first_name: "Mehedi", last_name: "Hasan" };
const bot = (text: string, extra: Record<string, unknown> = {}, from = USER, path = "/telegram/hook-secret") =>
  call("POST", path, { message: { chat: { id: from.id }, from, text, ...extra } });

async function signIn(): Promise<string> {
  const { code } = (await (await call("POST", "/auth/start", { turnstile_token: "t" })).json()) as { code: string };
  await bot(`/start login_${code}`);
  const { session } = (await (await call("GET", `/auth/poll/${code}`)).json()) as { session: string };
  return session;
}

describe("Continue with Telegram", () => {
  it("signs in when Start is pressed with the link, and the link only works once", async () => {
    const start = await call("POST", "/auth/start", { turnstile_token: "t" });
    expect(start.status).toBe(201);
    const { code, links } = (await start.json()) as { code: string; links: { gk: string; opp: string } };
    expect(links).toEqual({
      gk: `https://t.me/gklagbebot?start=login_${code}`,
      opp: `https://t.me/opponentlagbebot?start=login_${code}`,
    });
    expect(await (await call("GET", `/auth/poll/${code}`)).json()).toEqual({ status: "waiting" });

    await bot(`/start login_${code}`, {}, USER, "/telegram/opp/hook-secret"); // either bot works
    expect(replies.at(-1)?.text).toMatch(/signed in/i);
    expect(replies.at(-1)?.markup).toMatchObject({ keyboard: [[{ request_contact: true }]] });

    const signedIn = (await (await call("GET", `/auth/poll/${code}`)).json()) as { session: string; account: unknown };
    expect(signedIn.account).toEqual({ name: "Mehedi Hasan", phone: null, note: "", regions: [] });
    expect(signedIn.session).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect((await call("GET", `/auth/poll/${code}`)).status).toBe(404);

    // Someone else can't reuse the pressed link.
    await bot(`/start login_${code}`, {}, { id: 7, first_name: "X", last_name: "" });
    expect(replies.at(-1)?.text).toMatch(/expired or was already used/i);
  });

  it("signs in with a 6-digit code from /login, once", async () => {
    await bot("/login");
    const code = /(\d{6})/.exec(replies.at(-1)?.text ?? "")?.[1] as string;
    expect(code).toMatch(/^\d{6}$/);

    const ok = await call("POST", "/auth/otp", { code, turnstile_token: "t" });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { account: { name: string } }).account.name).toBe("Mehedi Hasan");
    expect((await call("POST", "/auth/otp", { code, turnstile_token: "t" })).status).toBe(400);
    expect((await call("POST", "/auth/otp", { code: "12345", turnstile_token: "t" })).status).toBe(400);
  });

  it("verifies only the person's own Bangladeshi number", async () => {
    const session = await signIn();
    await bot("", { contact: { phone_number: "+8801912345678", user_id: 999 } });
    expect(replies.at(-1)?.text).toMatch(/your own number/i);
    await bot("", { contact: { phone_number: "+12025550100", user_id: USER.id } });
    expect(replies.at(-1)?.text).toMatch(/bangladeshi/i);
    await bot("", { contact: { phone_number: "+8801912345678", user_id: USER.id } });
    expect(replies.at(-1)?.text).toMatch(/verified/i);

    const me = (await (await call("GET", "/me", undefined, session)).json()) as { account: { phone: string } };
    expect(me.account.phone).toBe("8801912345678");
  });

  it("saves the profile, lists owned posts with their manage tokens, and deletes everything", async () => {
    const session = await signIn();
    const saved = await call("PUT", "/me", { name: " Mehedi ", note: "5 years in goal", regions: ["dhaka", "atlantis"] }, session);
    expect(await saved.json()).toEqual({ account: { name: "Mehedi", phone: null, note: "5 years in goal", regions: ["dhaka"] } });
    expect((await call("PUT", "/me", { name: "" }, session)).status).toBe(400);

    const posted = await call(
      "POST",
      "/posts",
      {
        host_name: "Mehedi",
        phone: "01712345678",
        area: "Mirpur",
        district: "dhaka",
        start_datetime: "2026-10-01T14:00:00.000Z",
        turnstile_token: "t",
      },
      session,
    );
    const { post, edit_token } = (await posted.json()) as { post: { id: string }; edit_token: string };
    const me = (await (await call("GET", "/me", undefined, session)).json()) as { posts: unknown };
    expect(me.posts).toEqual([{ id: post.id, token: edit_token }]);

    await env.DB.prepare("INSERT INTO alerts (id, channel, address, regions) VALUES ('a', 'telegram', ?, '')").bind(String(USER.id)).run();
    expect(await (await call("DELETE", "/me", undefined, session)).json()).toEqual({ ok: true });
    expect((await call("GET", "/me", undefined, session)).status).toBe(401);
    const { results: alerts } = await env.DB.prepare("SELECT id FROM alerts").all();
    expect(alerts).toHaveLength(0);
    const owner = await env.DB.prepare("SELECT owner_tg_id FROM posts WHERE id = ?").bind(post.id).first<{ owner_tg_id: string | null }>();
    expect(owner?.owner_tg_id).toBeNull();
  });

  it("signs out, and refuses a made-up session", async () => {
    const session = await signIn();
    expect((await call("GET", "/me", undefined, "x".repeat(43))).status).toBe(401);
    await call("POST", "/auth/logout", {}, session);
    expect((await call("GET", "/me", undefined, session)).status).toBe(401);
  });
});

describe("account cleanup", () => {
  it("deletes accounts unused for 180 days, like Delete my data, and keeps active ones", async () => {
    await env.DB.prepare(
      `INSERT INTO accounts (tg_id, name, last_seen_at) VALUES ('old', 'Old', '2026-01-01 00:00:00'), ('new', 'New', '2026-09-30 00:00:00')`,
    ).run();
    await env.DB.prepare(
      `INSERT INTO sessions (token_hash, tg_id, last_used_at) VALUES ('h1', 'old', '2026-09-30 00:00:00'), ('h2', 'new', '2026-09-30 00:00:00')`,
    ).run();
    await env.DB.prepare("INSERT INTO alerts (id, channel, address, regions) VALUES ('a', 'telegram_opp', 'old', '')").run();

    const result = await cleanup(env.DB, NOW);
    expect(result).toMatchObject({ accounts: 1 });
    const { results } = await env.DB.prepare("SELECT tg_id FROM accounts").all<{ tg_id: string }>();
    expect(results.map((r) => r.tg_id)).toEqual(["new"]);
    const { results: sessions } = await env.DB.prepare("SELECT tg_id FROM sessions").all<{ tg_id: string }>();
    expect(sessions.map((s) => s.tg_id)).toEqual(["new"]);
    const { results: alerts } = await env.DB.prepare("SELECT id FROM alerts").all();
    expect(alerts).toHaveLength(0);
  });

  it("keeps a live Opponent Lagbe Telegram key", async () => {
    await env.DB.prepare("INSERT INTO telegram_links (code, regions, chat_id, bot, created_at) VALUES ('opp', '', '55', 'opp', '2026-09-01 00:00:00')").run();
    await env.DB.prepare("INSERT INTO alerts (id, channel, address, regions, boards) VALUES ('a', 'telegram_opp', '55', '', 'opponent_needed')").run();
    await cleanup(env.DB, NOW);
    expect(await env.DB.prepare("SELECT code FROM telegram_links").first()).toEqual({ code: "opp" });
  });
});
