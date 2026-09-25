import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import { notifyNewPost } from "./alerts/notify";
import {
  createLinkCode,
  createSession,
  deleteAccount,
  endSession,
  getAccount,
  ownedPosts,
  pollLinkCode,
  redeemOtp,
  sessionAccount,
  updateProfile,
  validateProfile,
} from "./auth/accounts";
import { type TelegramMessage, authReply, botForBoard, botsFor, replyTo, sendTelegram } from "./alerts/bots";
import {
  type BotKey,
  deleteAlert,
  normalizeBoards,
  normalizeRegions,
  saveAlert,
  saveTelegramCode,
  telegramChatFor,
  telegramStatus,
  updateAlertRegions,
} from "./alerts/repo";
import { isAllowedOrigin } from "./lib/origins";
import { randomId, randomToken } from "./lib/random";
import type { VerifyHuman } from "./lib/turnstile";
import {
  type ContactInfo,
  addInterest,
  getContactInfo,
  getPost,
  deletePost,
  insertPost,
  listFeed,
  listInterests,
  setStatus,
} from "./posts/repo";
import { type ContactMode, LISTING_TYPES, type ListingType, validateInterest, validateNewPost } from "./posts/validate";

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

const readRegions = (body: Record<string, unknown>) =>
  normalizeRegions(Array.isArray(body.regions) ? body.regions.filter((r): r is string => typeof r === "string") : []);


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
      allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      maxAge: 86400,
    }),
  );

  app.get("/health", (c) => c.json({ ok: true }));

  app.get("/posts", async (c) => {
    const area = c.req.query("area")?.trim() || undefined;
    const district = c.req.query("district")?.trim() || undefined;
    // Old clients (and the push service worker) omit type and get the keeper board.
    const rawType = c.req.query("type")?.trim();
    if (rawType && rawType !== "all" && !(LISTING_TYPES as readonly string[]).includes(rawType)) {
      return c.json({ error: "validation", fields: { type: "Use gk_needed, opponent_needed or all" } }, 400);
    }
    const listingType = (rawType || "gk_needed") as ListingType | "all";
    return c.json({ posts: await listFeed(c.env.DB, deps.now(), { area, district, listingType }) });
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
    // Signed in with Telegram? Then the post belongs to the account (My posts on any device).
    const owner = await sessionAccount(c.env.DB, c.req.header("Authorization"));
    if (owner) await c.env.DB.prepare("UPDATE posts SET owner_tg_id = ? WHERE id = ?").bind(owner, post.id).run();
    // Keepers watching this area hear about new keeper posts after the response goes out.
    // (Tests call the app without an ExecutionContext, so fall back to awaiting.)
    const fanOut = notifyNewPost(c.env, post).catch(() => undefined);
    try {
      c.executionCtx.waitUntil(fanOut);
    } catch {
      await fanOut;
    }
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

  // Host only: gone for good, with any requests.
  app.delete("/posts/:id", async (c) => {
    const token = c.req.header("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const outcome = await deletePost(c.env.DB, c.req.param("id"), token);
    if (outcome === "not_found") return c.json({ error: "not_found" }, 404);
    if (outcome === "forbidden") return c.json({ error: "forbidden" }, 403);
    return c.json({ ok: true });
  });

  // How many keepers hear about new GK Lagbe games (every channel counts once).
  app.get("/stats", async (c) => {
    const row = await c.env.DB.prepare(
      "SELECT COUNT(*) AS n FROM alerts WHERE instr(',' || boards || ',', ',gk_needed,') > 0",
    ).first<{ n: number }>();
    c.header("Cache-Control", "public, max-age=300");
    return c.json({ keepers: row?.n ?? 0 });
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

  // Someone asks to hear about new posts on one or both boards, near them.
  app.post("/alerts", async (c) => {
    const body = await readObject(c);
    if (!body) return c.json({ error: "invalid_json" }, 400);
    if (!(await isHuman(c, body))) return c.json({ error: "captcha_failed" }, 403);

    const regions = readRegions(body);
    const boards = body.boards === undefined ? "gk_needed" : normalizeBoards(body.boards);
    if (!boards) return c.json({ error: "validation", fields: { boards: "Pick at least one board" } }, 400);
    const subscription = body.subscription as { endpoint?: unknown } | undefined;
    if (typeof subscription?.endpoint !== "string" || !/^https:\/\//.test(subscription.endpoint)) {
      return c.json({ error: "validation", fields: { subscription: "A push subscription is required" } }, 400);
    }

    await saveAlert(c.env.DB, randomId(12), "push", subscription.endpoint, regions, boards);
    return c.json({ ok: true, regions, boards }, 201);
  });

  app.post("/alerts/off", async (c) => {
    const body = (await readObject(c)) ?? {};
    const endpoint = body.endpoint;
    if (typeof endpoint !== "string") return c.json({ error: "validation" }, 400);
    return c.json({ ok: await deleteAlert(c.env.DB, "push", endpoint) });
  });

  // New places (and boards) chosen on the Alerts page: move this browser's alert.
  // Knowing the (unguessable) push endpoint is what proves it's their browser.
  app.post("/alerts/regions", async (c) => {
    const body = (await readObject(c)) ?? {};
    if (typeof body.endpoint !== "string") return c.json({ error: "validation" }, 400);
    const regions = readRegions(body);
    const boards = body.boards === undefined ? undefined : normalizeBoards(body.boards);
    if (boards === "") return c.json({ error: "validation", fields: { boards: "Pick at least one board" } }, 400);
    if (!(await updateAlertRegions(c.env.DB, "push", body.endpoint, regions, boards))) return c.json({ error: "not_found" }, 404);
    return c.json({ ok: true, regions });
  });

  // The link code, kept in the browser, is its key to that chat's alerts.
  app.get("/alerts/telegram/:code", async (c) => c.json(await telegramStatus(c.env.DB, c.req.param("code"))));

  app.post("/alerts/telegram/:code/regions", async (c) => {
    const target = await telegramChatFor(c.env.DB, c.req.param("code"));
    const regions = readRegions((await readObject(c)) ?? {});
    if (!target || !(await updateAlertRegions(c.env.DB, target.channel, target.chatId, regions))) {
      return c.json({ error: "not_found" }, 404);
    }
    await c.env.DB.prepare("UPDATE telegram_links SET regions = ? WHERE code = ?").bind(regions, c.req.param("code")).run();
    return c.json({ ok: true, regions });
  });

  app.post("/alerts/telegram/:code/off", async (c) => {
    const target = await telegramChatFor(c.env.DB, c.req.param("code"));
    if (!target) return c.json({ error: "not_found" }, 404);
    return c.json({ ok: await deleteAlert(c.env.DB, target.channel, target.chatId) });
  });

  // Telegram: hand out a code for the chosen board's bot; opening it links the chat.
  app.post("/alerts/telegram", async (c) => {
    const body = await readObject(c);
    if (!body) return c.json({ error: "invalid_json" }, 400);
    if (!(await isHuman(c, body))) return c.json({ error: "captcha_failed" }, 403);
    const bot = botForBoard(botsFor(c.env), body.board);
    // Both are needed: without the token the bot could never answer the link.
    if (!bot.username || !bot.token) return c.json({ error: "telegram_unavailable" }, 503);

    const regions = readRegions(body);
    const code = randomId(16);
    await saveTelegramCode(c.env.DB, code, regions, bot.key);
    return c.json({ code, link: `https://t.me/${bot.username}?start=${code}`, board: bot.board }, 201);
  });

  const webhookSecretOk = (c: Ctx) =>
    Boolean(c.env.TELEGRAM_WEBHOOK_SECRET) && c.req.param("secret") === c.env.TELEGRAM_WEBHOOK_SECRET;

  // One-off: points both bots at their webhooks using the tokens already stored as
  // secrets, so a token never has to be handled anywhere else.
  app.post("/telegram/setup/:secret", async (c) => {
    if (!webhookSecretOk(c)) return c.json({ error: "forbidden" }, 403);
    const origin = new URL(c.req.url).origin;
    const results: Record<string, { ok: boolean; description: string | null } | null> = {};
    for (const bot of Object.values(botsFor(c.env))) {
      if (!bot.token) {
        results[bot.key] = null;
        continue;
      }
      const path = bot.key === "opp" ? `/telegram/opp/${c.env.TELEGRAM_WEBHOOK_SECRET}` : `/telegram/${c.env.TELEGRAM_WEBHOOK_SECRET}`;
      const response = await fetch(`https://api.telegram.org/bot${bot.token}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: origin + path, allowed_updates: ["message"] }),
      });
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; description?: string };
      results[bot.key] = { ok: body.ok === true, description: body.description ?? null };
    }
    if (!results.gk && !results.opp) return c.json({ error: "no_bot_token" }, 503);
    return c.json(results);
  });

  // Telegram calls these. The secret path segment is what proves it's really them.
  const webhook = (key: BotKey) => async (c: Ctx) => {
    if (!webhookSecretOk(c)) return c.json({ error: "forbidden" }, 403);
    const bot = botsFor(c.env)[key];
    const update = (await readObject(c)) ?? {};
    const message = update.message as TelegramMessage | undefined;
    const chatId = message?.chat?.id;
    if (!message || typeof chatId !== "number") return c.json({ ok: true });

    // Sign-in messages first, then the alert commands.
    const auth = await authReply(c.env.DB, message, c.env.SITE_URL);
    const reply = auth ?? { text: await replyTo(c.env.DB, bot, String(chatId), message.text ?? "", c.env.SITE_URL) };
    if (bot.token) await sendTelegram(bot.token, chatId, reply.text, fetch, "markup" in reply ? reply.markup : undefined).catch(() => undefined);
    return c.json({ ok: true });
  };
  app.post("/telegram/opp/:secret", webhook("opp"));
  app.post("/telegram/:secret", webhook("gk"));

  // ---- Continue with Telegram (optional accounts) ----

  const signedIn = async (c: Ctx, tgId: string) => {
    const session = await createSession(c.env.DB, tgId);
    return c.json({ session, account: await getAccount(c.env.DB, tgId) });
  };

  // The site asks for a sign-in link; pressing Start in either bot with it signs in.
  app.post("/auth/start", async (c) => {
    const body = (await readObject(c)) ?? {};
    if (!(await isHuman(c, body))) return c.json({ error: "captcha_failed" }, 403);
    const code = await createLinkCode(c.env.DB);
    const bots = botsFor(c.env);
    const link = (username?: string) => (username ? `https://t.me/${username}?start=login_${code}` : null);
    return c.json({ code, links: { gk: link(bots.gk.username), opp: link(bots.opp.username) } }, 201);
  });

  app.get("/auth/poll/:code", async (c) => {
    const result = await pollLinkCode(c.env.DB, c.req.param("code"));
    if (!result) return c.json({ error: "not_found" }, 404);
    if (result.status === "waiting") return c.json({ status: "waiting" });
    return signedIn(c, result.tgId);
  });

  // No Telegram on this device: the 6-digit code a bot sent after /login.
  app.post("/auth/otp", async (c) => {
    const body = (await readObject(c)) ?? {};
    if (!(await isHuman(c, body))) return c.json({ error: "captcha_failed" }, 403);
    const tgId = await redeemOtp(c.env.DB, typeof body.code === "string" ? body.code.trim() : "");
    if (!tgId) return c.json({ error: "bad_code" }, 400);
    return signedIn(c, tgId);
  });

  app.post("/auth/logout", async (c) => {
    await endSession(c.env.DB, c.req.header("Authorization"));
    return c.json({ ok: true });
  });

  app.get("/me", async (c) => {
    const tgId = await sessionAccount(c.env.DB, c.req.header("Authorization"));
    const account = tgId ? await getAccount(c.env.DB, tgId) : null;
    if (!tgId || !account) return c.json({ error: "signed_out" }, 401);
    return c.json({ account, posts: await ownedPosts(c.env.DB, tgId) });
  });

  app.put("/me", async (c) => {
    const tgId = await sessionAccount(c.env.DB, c.req.header("Authorization"));
    if (!tgId) return c.json({ error: "signed_out" }, 401);
    const result = validateProfile(await readObject(c));
    if (!result.ok) return c.json({ error: "validation", fields: result.errors }, 400);
    await updateProfile(c.env.DB, tgId, result.value);
    return c.json({ account: await getAccount(c.env.DB, tgId) });
  });

  // Delete my data.
  app.delete("/me", async (c) => {
    const tgId = await sessionAccount(c.env.DB, c.req.header("Authorization"));
    if (!tgId) return c.json({ error: "signed_out" }, 401);
    await deleteAccount(c.env.DB, tgId);
    return c.json({ ok: true });
  });

  return app;
}
