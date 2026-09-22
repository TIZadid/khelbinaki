import { describe, expect, it } from "vitest";
import { normalizeBdPhone, validateNewPost } from "../src/posts/validate";

const NOW = new Date("2026-10-01T10:00:00.000Z");
const valid = {
  host_name: "  Rafi ",
  phone: "01712345678",
  area: "Mirpur",
  start_datetime: "2026-10-01T20:00:00+06:00",
};

describe("normalizeBdPhone", () => {
  it.each([
    ["01712345678", "8801712345678"],
    ["+8801712345678", "8801712345678"],
    ["8801712345678", "8801712345678"],
    ["+880 1712-345678", "8801712345678"],
    ["019 1234 5678", "8801912345678"],
  ])("%s -> %s", (raw, expected) => expect(normalizeBdPhone(raw)).toBe(expected));

  it.each(["0171234567", "01212345678", "12345", "+1 202 555 0100", "017123456789"])("rejects %s", (raw) =>
    expect(normalizeBdPhone(raw)).toBeNull(),
  );
});

describe("validateNewPost", () => {
  it("accepts a minimal post, trims text, normalizes phone and time, applies defaults", () => {
    const r = validateNewPost(valid, NOW);
    expect(r).toEqual({
      ok: true,
      value: {
        host_name: "Rafi",
        phone: "8801712345678",
        area: "Mirpur",
        turf_name: null,
        start_datetime: "2026-10-01T14:00:00.000Z",
        duration_minutes: null,
        cost_per_head: null,
        slots_needed: 1,
        notes: null,
      },
    });
  });

  it("keeps optional fields", () => {
    const r = validateNewPost(
      { ...valid, turf_name: "Kings Arena", duration_minutes: 60, cost_per_head: 150, slots_needed: 2, notes: "Gloves" },
      NOW,
    );
    expect(r.ok && r.value).toMatchObject({ turf_name: "Kings Arena", duration_minutes: 60, cost_per_head: 150, slots_needed: 2, notes: "Gloves" });
  });

  it("reports every problem at once", () => {
    const r = validateNewPost({ phone: "123", start_datetime: "2026-09-30T10:00:00Z", cost_per_head: -5 }, NOW);
    expect(r.ok).toBe(false);
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(["area", "cost_per_head", "host_name", "phone", "start_datetime"]);
  });

  it("requires a timezone and a sane date", () => {
    const errorFor = (start_datetime: string) => {
      const r = validateNewPost({ ...valid, start_datetime }, NOW);
      return !r.ok && r.errors.start_datetime;
    };
    expect(errorFor("2026-10-01T20:00")).toMatch(/timezone/i);
    expect(errorFor("not a date")).toMatch(/invalid/i);
    expect(errorFor("2026-10-01T09:00:00Z")).toMatch(/future/i);
    expect(errorFor("2026-12-15T10:00:00Z")).toMatch(/60 days/i);
  });

  it("rejects non-integer and out-of-range numbers", () => {
    const r = validateNewPost({ ...valid, duration_minutes: 10, slots_needed: 1.5, cost_per_head: "150" }, NOW);
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(["cost_per_head", "duration_minutes", "slots_needed"]);
  });

  it("rejects over-long text", () => {
    const r = validateNewPost({ ...valid, notes: "x".repeat(501) }, NOW);
    expect(!r.ok && r.errors.notes).toMatch(/500/);
  });

  it("only accepts the gk_needed listing type for now", () => {
    expect(validateNewPost({ ...valid, listing_type: "gk_needed" }, NOW).ok).toBe(true);
    const r = validateNewPost({ ...valid, listing_type: "opponent_needed" }, NOW);
    expect(!r.ok && r.errors.listing_type).toBeTruthy();
  });

  it("treats non-object input as empty", () => {
    const r = validateNewPost("nope", NOW);
    expect(!r.ok && r.errors.host_name).toBe("Required");
  });
});
