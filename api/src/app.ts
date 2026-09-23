import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import { notifyNewPost } from "./alerts/notify";
import { deleteAlert, normalizeRegions, saveAlert, saveTelegramCode, takeTelegramCode } from "./alerts/repo";
import { regionName } from "./lib/bd";
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
    const district = c.req.query("district")?.trim() || undefined;
    return c.json({ posts: await listFeed(c.env.DB, deps.now(), { area, district }) });
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
    // Keepers watching this area hear about it after the response goes out.
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

  // Keepers ask to hear about new games near them.
  app.post("/alerts", async (c) => {
    const body = await readObject(c);
    if (!body) return c.json({ error: "invalid_json" }, 400);
    if (!(await isHuman(c, body))) return c.json({ error: "captcha_failed" }, 403);

    const regions = normalizeRegions(Array.isArray(body.regions) ? body.regions.filter((r): r is string => typeof r === "string") : []);
    const subscription = body.subscription as { endpoint?: unknown } | undefined;
    if (typeof subscription?.endpoint !== "string" || !/^https:\/\//.test(subscription.endpoint)) {
      return c.json({ error: "validation", fields: { subscription: "A push subscription is required" } }, 400);
    }

    await saveAlert(c.env.DB, randomId(12), "push", subscription.endpoint, regions);
    return c.json({ ok: true, regions }, 201);
  });

  app.post("/alerts/off", async (c) => {
    const body = (await readObject(c)) ?? {};
    const endpoint = body.endpoint;
    if (typeof endpoint !== "string") return c.json({ error: "validation" }, 400);
    return c.json({ ok: await deleteAlert(c.env.DB, "push", endpoint) });
  });

  // Telegram: hand out a one-use code, then the bot links the chat to those areas.
  app.post("/alerts/telegram", async (c) => {
    const body = await readObject(c);
    if (!body) return c.json({ error: "invalid_json" }, 400);
    if (!(await isHuman(c, body))) return c.json({ error: "captcha_failed" }, 403);
    if (!c.env.TELEGRAM_BOT_USERNAME) return c.json({ error: "telegram_unavailable" }, 503);

    const regions = normalizeRegions(Array.isArray(body.regions) ? body.regions.filter((r): r is string => typeof r === "string") : []);
    const code = randomId(10);
    await saveTelegramCode(c.env.DB, code, regions);
    return c.json({ code, link: `https://t.me/${c.env.TELEGRAM_BOT_USERNAME}?start=${code}` }, 201);
  });

  // One-off: points Telegram at the webhook using the bot token already stored
  // as a secret, so the token never has to be handled anywhere else.
  app.post("/telegram/setup/:secret", async (c) => {
    if (!c.env.TELEGRAM_WEBHOOK_SECRET || c.req.param("secret") !== c.env.TELEGRAM_WEBHOOK_SECRET) {
      return c.json({ error: "forbidden" }, 403);
    }
    if (!c.env.TELEGRAM_BOT_TOKEN) return c.json({ error: "no_bot_token" }, 503);

    const hookUrl = `${new URL(c.req.url).origin}/telegram/${c.env.TELEGRAM_WEBHOOK_SECRET}`;
    const response = await fetch(`https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: hookUrl, allowed_updates: ["message"] }),
    });
    const body = (await response.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    return c.json({ ok: body.ok === true, description: body.description ?? null }, response.ok ? 200 : 502);
  });

  // Telegram calls this. The secret path segment is what proves it's really them.
  app.post("/telegram/:secret", async (c) => {
    if (!c.env.TELEGRAM_WEBHOOK_SECRET || c.req.param("secret") !== c.env.TELEGRAM_WEBHOOK_SECRET) {
      return c.json({ error: "forbidden" }, 403);
    }
    const update = (await readObject(c)) ?? {};
    const message = update.message as { chat?: { id?: number }; text?: string } | undefined;
    const chatId = message?.chat?.id;
    const text = message?.text ?? "";
    if (typeof chatId !== "number") return c.json({ ok: true });

    const start = /^\/start\s+([0-9A-Za-z]{1,32})/.exec(text);
    let reply = "Send the link from the Khelbi Naki site to start getting alerts.";
    if (start) {
      const regions = await takeTelegramCode(c.env.DB, start[1]);
      if (regions === null) {
        reply = "That link has already been used. Get a fresh one from the site.";
      } else {
        await saveAlert(c.env.DB, randomId(12), "telegram", String(chatId), regions);
        reply = regions
          ? `Done. I'll message you when a game is posted in: ${regions.split(",").map((slug) => regionName(slug) ?? slug).join(", ")}.`
          : "Done. I'll message you when any new game is posted anywhere in Bangladesh.";
      }
    }
    if (/^\/stop/.test(text)) {
      await deleteAlert(c.env.DB, "telegram", String(chatId));
      reply = "Stopped. You won't get any more alerts.";
    }

    if (c.env.TELEGRAM_BOT_TOKEN) {
      await fetch(`https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: reply }),
      }).catch(() => undefined);
    }
    return c.json({ ok: true });
  });

  return app;
}
