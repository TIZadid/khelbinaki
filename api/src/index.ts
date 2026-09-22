import { createApp } from "./app";
import { turnstileVerifier } from "./lib/turnstile";

export default createApp({
  verifyHuman: (env) => turnstileVerifier(env.TURNSTILE_SECRET),
  now: () => new Date(),
});
