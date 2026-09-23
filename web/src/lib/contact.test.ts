import { describe, expect, it } from "vitest";
import type { PublicPost } from "./api";
import { formatPhone, postUrl, telUrl, whatsappContactUrl, whatsappShareUrl } from "./contact";

const post: PublicPost = {
  id: "aB3dE9xK2q",
  listing_type: "gk_needed",
  team_name: null,
  players_per_side: 5,
  host_name: "Rafi",
  contact_mode: "direct",
  area: "Mirpur",
  district: "dhaka",
  division: "div-dhaka",
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

const textOf = (url: string) => new URL(url).searchParams.get("text");

describe("contact links", () => {
  it("builds the post URL", () => {
    expect(postUrl(post.id, ORIGIN)).toBe("https://khelbinaki.zlabz.workers.dev/p/aB3dE9xK2q");
  });

  it("messages the host on WhatsApp about this specific post", () => {
    const url = whatsappContactUrl(post, ORIGIN, "8801712345678");
    expect(url.startsWith("https://wa.me/8801712345678?text=")).toBe(true);
    expect(textOf(url)).toBe(
      "Hi Rafi, I saw your Khelbi Naki post for Kings Arena, Mirpur, Dhaka on Thu 1 Oct at 7:30 PM. " +
        "I can play in goal. Is the spot still open?\nhttps://khelbinaki.zlabz.workers.dev/p/aB3dE9xK2q",
    );
  });

  it("shares to a WhatsApp group with the key details", () => {
    const url = whatsappShareUrl(post, ORIGIN);
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(textOf(url)).toBe(
      "Need a keeper! Kings Arena, Mirpur, Dhaka · Thu 1 Oct at 7:30 PM · 5-a-side · ৳150/head\nhttps://khelbinaki.zlabz.workers.dev/p/aB3dE9xK2q",
    );
  });

  it("asks an opponent team for the match, not for a keeper", () => {
    const match = { ...post, listing_type: "opponent_needed" as const, team_name: "FC Mirpur", players_per_side: 6 };
    expect(textOf(whatsappContactUrl(match, ORIGIN, "8801712345678"))).toBe(
      "Hi Rafi, I saw FC Mirpur's Khelbi Naki post for a 6-a-side at Kings Arena, Mirpur, Dhaka on Thu 1 Oct at 7:30 PM. " +
        "We'd like to play you. Is the match still open?\nhttps://khelbinaki.zlabz.workers.dev/p/aB3dE9xK2q",
    );
  });

  it("leaves out missing turf and cost", () => {
    const bare = { ...post, turf_name: null, cost_per_head: null };
    expect(textOf(whatsappShareUrl(bare, ORIGIN))).toBe(
      "Need a keeper! Mirpur, Dhaka · Thu 1 Oct at 7:30 PM · 5-a-side\nhttps://khelbinaki.zlabz.workers.dev/p/aB3dE9xK2q",
    );
  });

  it("formats call links and phone numbers", () => {
    expect(telUrl("8801712345678")).toBe("tel:+8801712345678");
    expect(formatPhone("8801712345678")).toBe("01712-345678");
  });
});
