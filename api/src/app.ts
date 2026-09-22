import { Hono } from "hono";
import { cors } from "hono/cors";
import { isAllowedOrigin } from "./lib/origins";
import { randomId, randomToken } from "./lib/random";
import type { VerifyHuman } from "./lib/turnstile";
import { getPost, insertPost, listFeed, setStatus } from "./posts/repo";
import { validateNewPost } from "./posts/validate";

export type Deps = {
  verifyHuman: (env: Env) => VerifyHuman;
  now: () => Date;
};

export function createApp(deps: Deps) {
  const app = new Hono<{ Bindings: Env }>();

  app.use(
    "*",
    cors({
      origin: (origin, c) => (isAllowedOrigin(origin, c.env.ALLOWED_ORIGINS) ? origin : null),
      allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
      allowHeaders: ["Content-Type"],
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
    const body = await c.req.json<unknown>().catch(() => null);
    if (typeof body !== "object" || body === null) return c.json({ error: "invalid_json" }, 400);

    // Validate first: Turnstile tokens are single-use, so a typo shouldn't burn one.
    const result = validateNewPost(body, deps.now());
    if (!result.ok) return c.json({ error: "validation", fields: result.errors }, 400);

    const token = (body as Record<string, unknown>).turnstile_token;
    const human =
      typeof token === "string" && (await deps.verifyHuman(c.env)(token, c.req.header("CF-Connecting-IP") ?? null));
    if (!human) return c.json({ error: "captcha_failed" }, 403);

    const editToken = randomToken();
    const post = await insertPost(c.env.DB, randomId(), editToken, result.value);
    return c.json({ post, edit_token: editToken }, 201);
  });

  app.patch("/posts/:id", async (c) => {
    const body = (await c.req.json<Record<string, unknown>>().catch(() => null)) ?? {};
    const { edit_token, status } = body;
    if (typeof edit_token !== "string" || (status !== "open" && status !== "filled")) {
      return c.json({ error: "validation" }, 400);
    }
    const id = c.req.param("id");
    const outcome = await setStatus(c.env.DB, id, edit_token, status);
    if (outcome === "not_found") return c.json({ error: "not_found" }, 404);
    if (outcome === "forbidden") return c.json({ error: "forbidden" }, 403);
    return c.json({ post: await getPost(c.env.DB, id) });
  });

  return app;
}
