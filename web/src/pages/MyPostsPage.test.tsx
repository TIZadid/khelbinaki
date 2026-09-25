import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadMyPosts, rememberMyPost } from "@/lib/myPosts";
import { MyPostsPage } from "./MyPostsPage";

const post = (id: string) => ({
  id, listing_type: "gk_needed", team_name: null, players_per_side: 5, contact_mode: "direct", host_name: "Rafi",
  area: "Mirpur", district: "dhaka", division: "div-dhaka", turf_name: null,
  start_datetime: "2026-10-01T13:30:00.000Z", duration_minutes: 60, cost_per_head: 150, slots_needed: 1,
  notes: null, status: "open", created_at: "2026-10-01 08:00:00",
});

afterEach(() => vi.unstubAllGlobals());

describe("MyPostsPage", () => {
  it("lists this phone's posts, marks cleared ones, and keeps posts it couldn't load", async () => {
    rememberMyPost({ id: "gone", token: "t3" });
    rememberMyPost({ id: "down", token: "t2" });
    rememberMyPost({ id: "live", token: "t1" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/live")) return new Response(JSON.stringify({ post: post("live") }));
        if (url.endsWith("/gone")) return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
        return new Response("{}", { status: 500 });
      }),
    );
    render(<MyPostsPage />);

    const live = (await screen.findByText("Mirpur")).closest("li") as HTMLElement;
    expect(within(live).getByRole("link", { name: /manage/i })).toHaveAttribute("href", "/p/live/manage#t=t1");
    expect(await screen.findByText(/^cleared —/i)).toBeInTheDocument();
    expect(await screen.findByText(/couldn't load/i)).toBeInTheDocument();
    expect(loadMyPosts().map((p) => p.id).sort()).toEqual(["down", "live"]);
  });

  it("explains when this phone has no posts", () => {
    render(<MyPostsPage />);
    expect(screen.getByText(/no posts on this phone/i)).toBeInTheDocument();
  });
});
