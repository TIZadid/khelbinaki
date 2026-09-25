import { afterEach, describe, expect, it, vi } from "vitest";
import { pollSignIn, readSession } from "./account";
import { loadKeeperProfile, saveKeeperProfile } from "./keeper";
import { loadMyPosts } from "./myPosts";

afterEach(() => vi.unstubAllGlobals());

describe("signing in with Telegram", () => {
  it("waits, then adopts the account: fills its gaps from this phone and brings its posts here", async () => {
    saveKeeperProfile({ name: "Mehedi", phone: "", regions: ["sylhet"], note: "5 years in goal" });
    const calls: { url: string; init?: RequestInit }[] = [];
    let pressed = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        if (url.includes("/auth/poll/")) {
          return new Response(
            JSON.stringify(
              pressed
                ? { session: "s".repeat(43), account: { name: "Mehedi Hasan", phone: "8801912345678", note: "", regions: [] } }
                : { status: "waiting" },
            ),
          );
        }
        if (url.endsWith("/me") && init?.method === "PUT") {
          return new Response(JSON.stringify({ account: { name: "Mehedi Hasan", phone: "8801912345678", ...JSON.parse(String(init.body)) } }));
        }
        if (url.endsWith("/me")) {
          return new Response(JSON.stringify({ account: {}, posts: [{ id: "p1", token: "t1" }] }));
        }
        return new Response("{}");
      }),
    );

    expect(await pollSignIn("code1")).toBe("waiting");
    expect(readSession()).toBeNull();

    pressed = true;
    const account = await pollSignIn("code1");
    expect(account).toMatchObject({ name: "Mehedi Hasan", regions: ["sylhet"], note: "5 years in goal" });
    expect(readSession()).toBe("s".repeat(43));
    const put = calls.find((c) => c.init?.method === "PUT");
    expect((put?.init?.headers as Record<string, string> | undefined)?.Authorization).toBe(`Bearer ${"s".repeat(43)}`);
    expect(loadKeeperProfile()).toEqual({ name: "Mehedi Hasan", phone: "8801912345678", regions: ["sylhet"], note: "5 years in goal" });
    expect(loadMyPosts()).toEqual([{ id: "p1", token: "t1" }]);
  });

  it("says when the link expired", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    expect(await pollSignIn("old")).toBe("expired");
  });
});
