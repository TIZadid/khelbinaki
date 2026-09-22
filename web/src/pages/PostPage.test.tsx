import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicPost } from "@/lib/api";
import { PostPage } from "./PostPage";

const NOW = new Date("2026-10-01T12:00:00.000Z"); // 6:00 PM Dhaka

const base: PublicPost = {
  id: "p1",
  listing_type: "gk_needed",
  host_name: "Rafi",
  phone: "8801712345678",
  area: "Mirpur",
  turf_name: "Kings Arena",
  start_datetime: "2026-10-01T13:30:00.000Z",
  duration_minutes: 60,
  cost_per_head: 150,
  slots_needed: 2,
  notes: "Bring gloves",
  status: "open",
  created_at: "2026-10-01 08:00:00",
};

function serve(post: PublicPost | null | Error) {
  const fn = vi.fn(async (_url: string) => {
    if (post instanceof Error) throw post;
    return post
      ? new Response(JSON.stringify({ post }), { status: 200 })
      : new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("PostPage", () => {
  it("shows the post with WhatsApp, call and share actions", async () => {
    const fetchMock = serve(base);
    render(<PostPage id="p1" now={NOW} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Mirpur" })).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/posts\/p1$/);
    expect(screen.getByText("Kings Arena")).toBeInTheDocument();
    expect(screen.getByText("7:30")).toBeInTheDocument();
    expect(screen.getByText("Bring gloves")).toBeInTheDocument();
    expect(screen.getByText("01712-345678")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /whatsapp rafi/i }).getAttribute("href")).toMatch(
      /^https:\/\/wa\.me\/8801712345678\?text=/,
    );
    expect(screen.getByRole("link", { name: /^call/i })).toHaveAttribute("href", "tel:+8801712345678");
    expect(screen.getByRole("link", { name: /share to a group/i }).getAttribute("href")).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(document.title).toMatch(/^Mirpur · 7:30 PM/);
  });

  it("hides contact actions once the game is filled", async () => {
    serve({ ...base, status: "filled" });
    render(<PostPage id="p1" now={NOW} />);
    expect(await screen.findByText(/host has found a keeper/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /whatsapp/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /share/i })).toBeNull();
  });

  it("hides contact actions once the match has started", async () => {
    serve({ ...base, start_datetime: "2026-10-01T11:00:00.000Z" });
    render(<PostPage id="p1" now={NOW} />);
    expect(await screen.findByText(/match has already started/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^call/i })).toBeNull();
  });

  it("says when a post does not exist", async () => {
    serve(null);
    render(<PostPage id="p1" now={NOW} />);
    expect(await screen.findByText(/doesn't exist/i)).toBeInTheDocument();
  });

  it("offers a retry when loading fails", async () => {
    const fetchMock = serve(new Error("offline"));
    render(<PostPage id="p1" now={NOW} />);
    fireEvent.click(await screen.findByRole("button", { name: /try again/i }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
