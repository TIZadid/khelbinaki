import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

const insert = (status?: string) =>
  env.DB.prepare(
    `INSERT INTO posts (id, host_name, phone, area, start_datetime, edit_token${status ? ", status" : ""})
     VALUES (?, ?, ?, ?, ?, ?${status ? ", ?" : ""})`,
  ).bind(
    crypto.randomUUID(),
    "Rafi",
    "8801711111111",
    "Mirpur",
    "2026-10-01T14:00:00.000Z",
    "token",
    ...(status ? [status] : []),
  );

describe("posts table", () => {
  it("applies defaults for listing_type, status, slots_needed, created_at", async () => {
    await insert().run();
    const row = await env.DB.prepare(
      "SELECT listing_type, status, slots_needed, created_at FROM posts",
    ).first<{ listing_type: string; status: string; slots_needed: number; created_at: string }>();
    expect(row).toMatchObject({ listing_type: "gk_needed", status: "open", slots_needed: 1 });
    expect(row?.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("rejects an unknown status", async () => {
    await expect(insert("deleted").run()).rejects.toThrow(/CHECK constraint failed/);
  });
});
