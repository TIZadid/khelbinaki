import { describe, expect, it } from "vitest";
import { countdownParts, formatCountdown, formatDay, formatTime, groupKey, groupPosts, isStartingSoon } from "./time";

const NOW = new Date("2026-10-01T12:00:00.000Z"); // Thu 1 Oct, 6:00 PM in Dhaka (UTC+6)
const at = (iso: string) => new Date(iso);

describe("groupKey (Dhaka calendar days)", () => {
  it("splits at Dhaka midnight, not UTC midnight", () => {
    expect(groupKey(at("2026-10-01T17:59:00Z"), NOW)).toBe("today"); // 11:59 PM Dhaka
    expect(groupKey(at("2026-10-01T18:00:00Z"), NOW)).toBe("tomorrow"); // 12:00 AM Fri
  });

  it("uses this week for 2-6 days out and later beyond", () => {
    expect(groupKey(at("2026-10-06T12:00:00Z"), NOW)).toBe("week");
    expect(groupKey(at("2026-10-08T12:00:00Z"), NOW)).toBe("later");
  });
});

describe("groupPosts", () => {
  it("returns non-empty groups in fixed order, keeping post order", () => {
    const posts = [
      { id: "a", start_datetime: "2026-10-01T13:00:00Z" },
      { id: "b", start_datetime: "2026-10-02T13:00:00Z" },
      { id: "c", start_datetime: "2026-10-01T15:00:00Z" },
      { id: "d", start_datetime: "2026-10-20T13:00:00Z" },
    ];
    const groups = groupPosts(posts, NOW);
    expect(groups.map((g) => [g.label, g.posts.map((p) => p.id)])).toEqual([
      ["Today", ["a", "c"]],
      ["Tomorrow", ["b"]],
      ["Later", ["d"]],
    ]);
  });
});

describe("isStartingSoon", () => {
  it("is true only within the next 3 hours", () => {
    expect(isStartingSoon(at("2026-10-01T15:00:00Z"), NOW)).toBe(true);
    expect(isStartingSoon(at("2026-10-01T15:01:00Z"), NOW)).toBe(false);
    expect(isStartingSoon(at("2026-10-01T11:59:00Z"), NOW)).toBe(false);
  });
});

describe("formatting", () => {
  it("shows Dhaka wall-clock time and day", () => {
    expect(formatTime(at("2026-10-01T14:30:00Z"))).toBe("8:30 PM");
    expect(formatDay(at("2026-10-01T14:30:00Z"))).toBe("Thu 1 Oct");
  });

  it("formats countdowns", () => {
    expect(formatCountdown(at("2026-10-01T13:30:00Z"), NOW)).toBe("in 1h 30m");
    expect(formatCountdown(at("2026-10-01T12:25:00Z"), NOW)).toBe("in 25m");
    expect(formatCountdown(at("2026-10-01T15:00:00Z"), NOW)).toBe("in 3h 00m");
  });
});

describe("countdownParts", () => {
  it("shows hours and minutes under a day", () => {
    expect(countdownParts(at("2026-10-01T13:15:00Z"), NOW)).toEqual([
      { value: "01", label: "HRS" },
      { value: "15", label: "MIN" },
    ]);
  });

  it("shows days and hours from a day out", () => {
    expect(countdownParts(at("2026-10-03T15:00:00Z"), NOW)).toEqual([
      { value: "02", label: "DAYS" },
      { value: "03", label: "HRS" },
    ]);
    expect(countdownParts(at("2026-10-02T12:00:00Z"), NOW)[0]).toEqual({ value: "01", label: "DAY" });
  });
});
