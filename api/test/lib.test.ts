import { describe, expect, it } from "vitest";
import { isAllowedOrigin } from "../src/lib/origins";
import { randomId, randomToken } from "../src/lib/random";
import { turnstileVerifier } from "../src/lib/turnstile";

describe("randomId / randomToken", () => {
  it("makes base62 ids of the requested length", () => {
    expect(randomId()).toMatch(/^[0-9A-Za-z]{10}$/);
    expect(randomId(16)).toMatch(/^[0-9A-Za-z]{16}$/);
    expect(randomId()).not.toBe(randomId());
  });

  it("makes 43-char url-safe tokens", () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(randomToken());
  });
});

describe("turnstileVerifier", () => {
  const fakeFetch = (reply: unknown, ok = true) => {
    const calls: FormData[] = [];
    const fetcher = (async (_url: string, init: RequestInit) => {
      calls.push(init.body as FormData);
      return new Response(JSON.stringify(reply), { status: ok ? 200 : 500 });
    }) as unknown as typeof fetch;
    return { calls, fetcher };
  };

  it("sends secret, token and ip, and returns success", async () => {
    const { calls, fetcher } = fakeFetch({ success: true });
    expect(await turnstileVerifier("sekret", fetcher)("tok", "1.2.3.4")).toBe(true);
    expect(calls[0].get("secret")).toBe("sekret");
    expect(calls[0].get("response")).toBe("tok");
    expect(calls[0].get("remoteip")).toBe("1.2.3.4");
  });

  it("returns false when Cloudflare says no or errors", async () => {
    expect(await turnstileVerifier("s", fakeFetch({ success: false }).fetcher)("t", null)).toBe(false);
    expect(await turnstileVerifier("s", fakeFetch({}, false).fetcher)("t", null)).toBe(false);
  });

  it("fails closed when no secret is configured", async () => {
    const { calls, fetcher } = fakeFetch({ success: true });
    expect(await turnstileVerifier(undefined, fetcher)("t", null)).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe("isAllowedOrigin", () => {
  const list = "https://khelbinaki.zlabz.workers.dev, https://*-khelbinaki.zlabz.workers.dev,http://localhost:5173";

  it("allows listed origins and wildcard previews", () => {
    expect(isAllowedOrigin("https://khelbinaki.zlabz.workers.dev", list)).toBe(true);
    expect(isAllowedOrigin("https://3f2a91c0-khelbinaki.zlabz.workers.dev", list)).toBe(true);
    expect(isAllowedOrigin("http://localhost:5173", list)).toBe(true);
  });

  it("rejects everything else", () => {
    expect(isAllowedOrigin("https://evil.example", list)).toBe(false);
    expect(isAllowedOrigin("https://a.b-khelbinaki.zlabz.workers.dev", list)).toBe(false);
    expect(isAllowedOrigin("https://khelbinaki.zlabz.workers.dev.evil.example", list)).toBe(false);
  });
});
