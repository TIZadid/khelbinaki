import { describe, expect, it } from "vitest";
import { buildMeta, escapeHtml, type MetaPost } from "./ogMeta";

const post: MetaPost = {
  area: "Mirpur",
  district: "dhaka",
  turf_name: "Kings Arena",
  start_datetime: "2026-10-01T13:30:00.000Z", // Thu 1 Oct, 7:30 PM Dhaka
  cost_per_head: 150,
  duration_minutes: 60,
  slots_needed: 1,
  status: "open",
};
const URL_ = "https://khelbinaki.zlabz.workers.dev/p/aB3dE9xK2q";

describe("buildMeta", () => {
  it("describes the game in the preview card", () => {
    expect(buildMeta(post, URL_)).toEqual({
      title: "Keeper needed · Kings Arena, Mirpur, Dhaka · Thu 1 Oct 7:30 PM",
      description: "৳150 per head · 60 min · Tap to contact the host on Khelbi Naki.",
      url: URL_,
    });
  });

  it("says when a game is filled, and copes with missing details", () => {
    const meta = buildMeta({ ...post, status: "filled", turf_name: null, cost_per_head: null, duration_minutes: null, slots_needed: 2 }, URL_);
    expect(meta.title).toBe("Filled · Mirpur, Dhaka · Thu 1 Oct 7:30 PM");
    expect(meta.description).toBe("Cost: ask the host · 2 keepers needed · This game is filled.");
  });
});

describe("escapeHtml", () => {
  it("describes an opponent post by its team, format and cost per team", () => {
    const meta = buildMeta(
      { ...post, listing_type: "opponent_needed", team_name: "FC Mirpur", players_per_side: 6, cost_per_head: 1500 },
      URL_,
    );
    expect(meta.title).toMatch(/^Opponent needed · FC Mirpur · /);
    expect(meta.description).toMatch(/^6-a-side · ৳1500 per team · /);
    expect(meta.description).toMatch(/take on FC Mirpur/);
  });

  it("keeps host-written text out of the markup", () => {
    expect(escapeHtml('Mirpur <script>"x"</script>')).toBe("Mirpur &lt;script&gt;&quot;x&quot;&lt;/script&gt;");
  });
});
