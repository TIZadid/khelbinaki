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
