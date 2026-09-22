import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Interest, PublicPost } from "@/lib/api";
import { ManagePage } from "./ManagePage";

const post: PublicPost = {
  id: "p1",
  listing_type: "gk_needed",
  contact_mode: "requests",
  host_name: "Nabil",
  area: "Mirpur",
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

function serve(overrides: { post?: PublicPost; interests?: Interest[] } = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url.endsWith("/interests")) return new Response(JSON.stringify({ interests: overrides.interests ?? interests }), { status: 200 });
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
  it("offers a WhatsApp share link for the post", async () => {
    serve();
    window.history.pushState(null, "", "/p/p1/manage#t=secret-token");
    render(<ManagePage id="p1" />);
    const share = within(await screen.findByRole("region", { name: /share your post/i }));
    expect(share.getByRole("link", { name: /share/i }).getAttribute("href")).toMatch(/^https:\/\/wa\.me\/\?text=/);
  });
});
