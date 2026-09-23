import { createApp } from "./app";
import { cleanup } from "./cleanup";
import { turnstileVerifier } from "./lib/turnstile";

const app = createApp({
  verifyHuman: (env) => turnstileVerifier(env.TURNSTILE_SECRET),
  now: () => new Date(),
});

export default {
  fetch: app.fetch,
  // Hourly (see "triggers" in wrangler.jsonc): archive ended posts, delete old ones.
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(cleanup(env.DB, new Date()).then((result) => console.log("cleanup", JSON.stringify(result))));
  },
} satisfies ExportedHandler<Env>;
