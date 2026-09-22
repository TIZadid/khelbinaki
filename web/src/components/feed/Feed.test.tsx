import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AsyncState } from "@/hooks/useAsync";
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

const ready = (data: PublicPost[]): AsyncState<PublicPost[]> => ({ status: "ready", data });
const renderFeed = (state: AsyncState<PublicPost[]>, retry = vi.fn()) =>
  render(<Feed state={state} retry={retry} now={NOW} />);

const rowFor = (time: string) => screen.getByText(time).closest("li") as HTMLElement;

describe("Feed", () => {
  it("groups by Dhaka day and marks only the soonest open game", () => {
    renderFeed(ready(POSTS));

    expect(screen.getByRole("heading", { name: /^today/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^tomorrow/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /open games/i })).toHaveTextContent("3");
    expect(within(rowFor("7:30 PM")).getByText("In 1h 30m")).toBeInTheDocument();
    expect(rowFor("7:30 PM").firstElementChild).toHaveAttribute("data-soonest", "true");
    expect(rowFor("10:00 PM").firstElementChild).not.toHaveAttribute("data-soonest");
    expect(rowFor("8:00 PM")).toHaveTextContent("Filled");
    expect(rowFor("6:00 PM")).toHaveTextContent("Ask");
  });

  it("links each row to its game and to the host", () => {
    renderFeed(ready(POSTS));

    const soon = rowFor("7:30 PM");
    expect(within(soon).getByRole("link", { name: "Mirpur" })).toHaveAttribute("href", "/p/soon");
    expect(within(soon).getByRole("link", { name: /whatsapp rafi/i }).getAttribute("href")).toMatch(
      /^https:\/\/wa\.me\/8801712345678\?text=/,
    );
    expect(within(soon).getByRole("link", { name: /call rafi/i })).toHaveAttribute("href", "tel:+8801712345678");
    expect(within(rowFor("8:00 PM")).queryByRole("link", { name: /whatsapp/i })).toBeNull();
  });

  it("filters by area chip", () => {
    renderFeed(ready(POSTS));

    fireEvent.click(screen.getByRole("button", { name: /^agrabad/i }));
    expect(screen.queryByText("10:00 PM")).toBeNull();
    expect(screen.getByText("6:00 PM")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^agrabad/i })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: /^all/i }));
    expect(screen.getByText("10:00 PM")).toBeInTheDocument();
  });

  it("shows loading, empty and error states", () => {
    const retry = vi.fn();
    const { rerender } = renderFeed({ status: "loading" });
    expect(screen.getByLabelText(/loading games/i)).toBeInTheDocument();

    rerender(<Feed state={ready([])} retry={retry} now={NOW} />);
    expect(screen.getByText(/no upcoming games/i)).toBeInTheDocument();

    rerender(<Feed state={{ status: "error" }} retry={retry} now={NOW} />);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
