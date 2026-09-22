import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicPost } from "@/lib/api";
import { Feed } from "./Feed";

const NOW = new Date("2026-10-01T12:00:00.000Z"); // 6:00 PM Dhaka

function post(over: Partial<PublicPost>): PublicPost {
  return {
    id: "p",
    listing_type: "gk_needed",
    host_name: "Rafi",
    phone: "8801712345678",
    area: "Mirpur",
    turf_name: "Kings Arena",
    start_datetime: "2026-10-01T13:30:00.000Z",
    duration_minutes: 60,
    cost_per_head: 150,
    slots_needed: 1,
    notes: null,
    status: "open",
    created_at: "2026-10-01 08:00:00",
    ...over,
  };
}

const POSTS = [
  post({ id: "soon", start_datetime: "2026-10-01T13:30:00.000Z" }), // 7:30 PM, in 1h 30m
  post({ id: "filled", start_datetime: "2026-10-01T14:00:00.000Z", status: "filled" }), // 8:00 PM
  post({ id: "late", start_datetime: "2026-10-01T16:00:00.000Z" }), // 10:00 PM
  post({ id: "tmrw", area: "Agrabad", turf_name: null, cost_per_head: null, start_datetime: "2026-10-02T12:00:00.000Z" }), // 6:00 PM
];

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

function mockFetch(...replies: (unknown | Error)[]) {
  const fn = vi.fn();
  for (const r of replies) {
    if (r instanceof Error) fn.mockRejectedValueOnce(r);
    else fn.mockImplementationOnce(async () => json(r));
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}

const cardFor = (time: string) => screen.getByText(time).closest(".glow-card") as HTMLElement;

afterEach(() => vi.unstubAllGlobals());

describe("Feed", () => {
  it("groups by Dhaka day and highlights only the soonest open game", async () => {
    mockFetch({ posts: POSTS });
    render(<Feed now={NOW} />);

    expect(await screen.findByRole("heading", { name: /^today/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^tomorrow/i })).toBeInTheDocument();
    expect(cardFor("7:30 PM")).toHaveClass("bg-primary");
    expect(cardFor("10:00 PM")).not.toHaveClass("bg-primary");
    expect(screen.getByText("Starts in 1h 30m")).toBeInTheDocument();
    expect(cardFor("8:00 PM")).toHaveTextContent("Filled");
    expect(screen.getByText("3 open games")).toBeInTheDocument();
    expect(cardFor("6:00 PM")).toHaveTextContent("Cost: ask host");
    const soonCard = cardFor("7:30 PM");
    expect(within(soonCard).getByRole("link", { name: "Mirpur" })).toHaveAttribute("href", "/p/soon");
    expect(within(soonCard).getByRole("link", { name: /whatsapp rafi/i }).getAttribute("href")).toMatch(/^https:\/\/wa\.me\/8801712345678\?text=/);
    expect(within(soonCard).getByRole("link", { name: /call rafi/i })).toHaveAttribute("href", "tel:+8801712345678");
    expect(within(cardFor("8:00 PM")).queryByRole("link", { name: /whatsapp/i })).toBeNull();
  });

  it("filters by area chip", async () => {
    mockFetch({ posts: POSTS });
    render(<Feed now={NOW} />);

    fireEvent.click(await screen.findByRole("button", { name: /^agrabad/i }));
    expect(screen.queryByText("10:00 PM")).toBeNull();
    expect(screen.getByText("6:00 PM")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^agrabad/i })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: /^all/i }));
    expect(screen.getByText("10:00 PM")).toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    mockFetch({ posts: [] });
    render(<Feed now={NOW} />);
    expect(await screen.findByText(/no upcoming games/i)).toBeInTheDocument();
  });

  it("shows an error with retry", async () => {
    const fetchMock = mockFetch(new Error("offline"), { posts: POSTS });
    render(<Feed now={NOW} />);

    fireEvent.click(await screen.findByRole("button", { name: /try again/i }));
    expect(await screen.findByText("7:30 PM")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
