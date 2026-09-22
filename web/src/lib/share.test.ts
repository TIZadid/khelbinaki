import { describe, expect, it } from "vitest";
import type { PublicPost } from "./api";
import { shareTargets, shareText } from "./share";

const post: PublicPost = {
  id: "aB3dE9xK2q",
  listing_type: "gk_needed",
  contact_mode: "direct",
  host_name: "Rafi",
  area: "Mirpur",
  turf_name: "Kings Arena",
  start_datetime: "2026-10-01T13:30:00.000Z", // Thu 1 Oct, 7:30 PM Dhaka
  duration_minutes: 60,
  cost_per_head: 150,
  slots_needed: 1,
  notes: null,
  status: "open",
  created_at: "2026-10-01 08:00:00",
};
const ORIGIN = "https://khelbinaki.zlabz.workers.dev";
const URL_ = `${ORIGIN}/p/aB3dE9xK2q`;

describe("shareText", () => {
  it("reads as one line in a group chat", () => {
    expect(shareText(post)).toBe("Need a keeper! Kings Arena, Mirpur · Thu 1 Oct at 7:30 PM · ৳150/head");
    expect(shareText({ ...post, turf_name: null, cost_per_head: null })).toBe(
      "Need a keeper! Mirpur · Thu 1 Oct at 7:30 PM",
    );
  });
});

describe("shareTargets", () => {
  const byKey = Object.fromEntries(shareTargets(post, ORIGIN).map((t) => [t.key, t.href]));

  it("sends text plus link to WhatsApp and Telegram", () => {
    expect(byKey.whatsapp).toBe(`https://wa.me/?text=${encodeURIComponent(`${shareText(post)}\n${URL_}`)}`);
    expect(byKey.telegram).toContain(encodeURIComponent(URL_));
    expect(byKey.telegram).toContain(encodeURIComponent(shareText(post)));
  });

  it("sends only the link to Facebook, which shows its preview card", () => {
    expect(byKey.facebook).toBe(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(URL_)}`);
  });
});
