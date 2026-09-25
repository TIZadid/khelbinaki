import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Interest, PublicPost } from "@/lib/api";
import { loadMyPosts } from "@/lib/myPosts";
import { ManagePage } from "./ManagePage";

const post: PublicPost = {
  id: "p1",
  listing_type: "gk_needed",
  team_name: null,
  players_per_side: 5,
  contact_mode: "requests",
  host_name: "Nabil",
  area: "Mirpur",
  district: "dhaka",
  division: "div-dhaka",
  turf_name: "Striker Turf",
  start_datetime: "2026-10-01T17:00:00.000Z",
  duration_minutes: 90,
  cost_per_head: 200,
  slots_needed: 2,
  notes: null,
  status: "open",
  created_at: "2026-10-01 08:00:00",
};

const interests: Interest[] = [
  { name: "Mehedi", phone: "8801912345678", note: "5 years in goal", created_at: "2026-10-01 12:00:00" },
];

function serve(overrides: { post?: PublicPost; interests?: Interest[]; deleteStatus?: number } = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url.endsWith("/interests")) return new Response(JSON.stringify({ interests: overrides.interests ?? interests }), { status: 200 });
    if (init?.method === "DELETE") return new Response(JSON.stringify({ ok: true }), { status: overrides.deleteStatus ?? 200 });
    if (init?.method === "PATCH") return new Response(JSON.stringify({ post: { ...post, status: "filled" } }), { status: 200 });
    return new Response(JSON.stringify({ post: overrides.post ?? post }), { status: 200 });
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState(null, "", "/");
});

describe("ManagePage", () => {
  it("shows the post, its interested keepers and the share card", async () => {
    const calls = serve();
    window.history.pushState(null, "", "/p/p1/manage#t=secret-token");
    render(<ManagePage id="p1" />);

    expect(await screen.findByRole("heading", { level: 1, name: /mirpur · 11:00 pm/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /share your post/i })).toBeInTheDocument();
    const list = await screen.findByRole("heading", { name: /interested/i });
    expect(list).toHaveTextContent("1");
    expect(screen.getByText("Mehedi")).toBeInTheDocument();
    expect(screen.getByText("01912-345678")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /whatsapp mehedi/i }).getAttribute("href")).toMatch(/^https:\/\/wa\.me\/8801912345678/);
    // The token travels in the Authorization header, never in the URL.
    const interestCall = calls.find((c) => c.url.endsWith("/interests"));
    expect((interestCall?.init?.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
  });

  it("marks the post filled with the edit token", async () => {
    const calls = serve();
    window.history.pushState(null, "", "/p/p1/manage#t=secret-token");
    render(<ManagePage id="p1" />);

    fireEvent.click(await screen.findByRole("button", { name: /mark as filled/i }));
    expect(await screen.findByRole("button", { name: /reopen this post/i })).toBeInTheDocument();
    const patch = calls.find((c) => c.init?.method === "PATCH");
    expect(JSON.parse(String(patch?.init?.body ?? "{}"))).toEqual({ edit_token: "secret-token", status: "filled" });
  });

  it("explains direct-contact posts instead of listing requests", async () => {
    serve({ post: { ...post, contact_mode: "direct" } });
    window.history.pushState(null, "", "/p/p1/manage#t=secret-token");
    render(<ManagePage id="p1" />);

    expect(await screen.findByText(/keepers tap contact host/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /interested/i })).toBeNull();
  });
});

describe("share card", () => {
  it("opens the share panel with WhatsApp, Facebook and Telegram", async () => {
    serve();
    window.history.pushState(null, "", "/p/p1/manage#t=secret-token");
    render(<ManagePage id="p1" />);

    const share = within(await screen.findByRole("region", { name: /share your post/i }));
    fireEvent.click(share.getByRole("button", { name: /^share$/i }));

    const dialog = within(await screen.findByRole("dialog", { name: /share this post/i }));
    expect(dialog.getByRole("link", { name: "WhatsApp" }).getAttribute("href")).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(dialog.getByRole("link", { name: "Facebook" }).getAttribute("href")).toMatch(/facebook\.com\/sharer/);
    expect(dialog.getByRole("link", { name: "Telegram" }).getAttribute("href")).toMatch(/t\.me\/share/);
  });
});

describe("owning a post without an account", () => {
  it("asks to save the manage link right after posting", async () => {
    serve();
    window.history.pushState(null, "", "/p/p1/manage#t=secret-token&new=1");
    render(<ManagePage id="p1" />);
    const banner = within(await screen.findByRole("region", { name: /save this page's link/i }));
    expect(banner.getByRole("link", { name: /send to my whatsapp/i }).getAttribute("href")).toMatch(/^https:\/\/wa\.me\/\?text=.*manage/);
  });

  it("remembers a manage link opened on a new phone", async () => {
    serve();
    window.history.pushState(null, "", "/p/p1/manage#t=secret-token");
    render(<ManagePage id="p1" />);
    await screen.findByRole("heading", { level: 1 });
    expect(loadMyPosts()).toEqual([{ id: "p1", token: "secret-token" }]);
  });

  it("deletes after confirming, and forgets the post", async () => {
    const calls = serve();
    window.history.pushState(null, "", "/p/p1/manage#t=secret-token");
    render(<ManagePage id="p1" />);
    fireEvent.click(await screen.findByRole("button", { name: /^delete post$/i }));
    await screen.findByText(/also removes 1 request/i);
    fireEvent.click(screen.getByRole("button", { name: /yes, delete/i }));
    expect(await screen.findByRole("heading", { name: /deleted/i })).toBeInTheDocument();
    const del = calls.find((c) => c.init?.method === "DELETE");
    expect((del?.init?.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
    expect(loadMyPosts()).toEqual([]);
  });

  it("treats a post the cleanup already removed as deleted", async () => {
    serve({ deleteStatus: 404 });
    window.history.pushState(null, "", "/p/p1/manage#t=secret-token");
    render(<ManagePage id="p1" />);
    fireEvent.click(await screen.findByRole("button", { name: /^delete post$/i }));
    fireEvent.click(screen.getByRole("button", { name: /yes, delete/i }));
    expect(await screen.findByRole("heading", { name: /deleted/i })).toBeInTheDocument();
  });
});
