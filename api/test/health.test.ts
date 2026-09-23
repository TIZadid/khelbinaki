import { env } from "cloudflare:workers";
import { createExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../src/index";

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await worker.fetch(new Request("https://api.example/health"), env, createExecutionContext());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("exposes the hourly cleanup", () => {
    expect(typeof worker.scheduled).toBe("function");
  });
});
