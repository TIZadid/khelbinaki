import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { cleanup } from "../src/cleanup";

const NOW = new Date("2026-10-05T12:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

async function post(id: string, start: string, duration: number | null, status = "open") {
  await env.DB.prepare(
    "INSERT INTO posts (id, host_name, phone, area, district, division, start_datetime, duration_minutes, status, edit_token) VALUES (?, 'X', '8801711111111', 'Mirpur', 'dhaka', 'div-dhaka', ?, ?, ?, 't')",
  )
    .bind(id, start, duration, status)
    .run();
}
const statusOf = async (id: string) =>
  (await env.DB.prepare("SELECT status FROM posts WHERE id = ?").bind(id).first<{ status: string }>())?.status ?? null;

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM interests").run();
  await env.DB.prepare("DELETE FROM posts").run();
  await env.DB.prepare("DELETE FROM alerts").run();
  await env.DB.prepare("DELETE FROM telegram_links").run();
});

describe("cleanup", () => {
  it("archives a post once its slot has ended, not before", async () => {
    await post("playing", hoursAgo(0.5), 60); // ends in 30 min
    await post("ended", hoursAgo(1.5), 60); // ended 30 min ago
    await post("nolength", hoursAgo(1.5), null); // assumed 2h slot: still on

    const result = await cleanup(env.DB, NOW);
    expect(result.archived).toBe(1);
    expect(await statusOf("playing")).toBe("open");
    expect(await statusOf("ended")).toBe("archived");
    expect(await statusOf("nolength")).toBe("open");
  });

  it("deletes posts and their requests 48 hours after the slot ends", async () => {
    await post("old", hoursAgo(50), 60); // ended 49h ago
    await post("recent", hoursAgo(40), 60, "archived"); // ended 39h ago
    await env.DB.prepare("INSERT INTO interests (id, post_id, name, phone) VALUES ('i1', 'old', 'Mehedi', '8801912345678')").run();

    const result = await cleanup(env.DB, NOW);
    expect(result).toMatchObject({ deleted: 1, requests: 1 });
    expect(await statusOf("old")).toBeNull();
    expect(await statusOf("recent")).toBe("archived");
    const { results } = await env.DB.prepare("SELECT id FROM interests").all();
    expect(results).toHaveLength(0);
  });

  it("clears Telegram codes nobody used or whose alerts are off, keeping live ones", async () => {
    const old = "2026-10-03 12:00:00";
    await env.DB.prepare(
      `INSERT INTO telegram_links (code, regions, chat_id, created_at) VALUES
        ('unused', '', NULL, ?), ('fresh', '', NULL, datetime('2026-10-05 11:00:00')), ('live', '', '42', ?), ('stopped', '', '99', ?)`,
    )
      .bind(old, old, old)
      .run();
    await env.DB.prepare("INSERT INTO alerts (id, channel, address, regions) VALUES ('a', 'telegram', '42', '')").run();

    expect((await cleanup(env.DB, NOW)).telegramLinks).toBe(2);
    const { results } = await env.DB.prepare("SELECT code FROM telegram_links ORDER BY code").all<{ code: string }>();
    expect(results.map((r) => r.code)).toEqual(["fresh", "live"]);
  });
});
