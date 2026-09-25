import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicPost } from "@/lib/api";
import { PostPage } from "./PostPage";

const NOW = new Date("2026-10-01T12:00:00.000Z"); // 6:00 PM Dhaka

const base: PublicPost = {
  id: "p1",
  listing_type: "gk_needed",
  team_name: null,
  players_per_side: 5,
  host_name: "Rafi",
  contact_mode: "direct",
  area: "Mirpur",
  district: "dhaka",
  division: "div-dhaka",
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
  it("shows the post and offers to contact the host", async () => {
    const fetchMock = serve(base);
    render(<PostPage id="p1" now={NOW} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Mirpur" })).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/posts\/p1$/);
    expect(screen.getByText("Kings Arena · Dhaka")).toBeInTheDocument();
    expect(screen.getByText("7:30")).toBeInTheDocument();
    expect(screen.getByText("Bring gloves")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /contact host/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /share to a group/i })).toBeInTheDocument();
    expect(screen.queryByText(/01712/)).toBeNull();
    await waitFor(() => expect(document.title).toMatch(/^Mirpur · 7:30 PM/));
  });

  it("shows an opponent post as the team versus you, priced per team", async () => {
    const opponent = { ...base, listing_type: "opponent_needed" as const, team_name: "FC Mirpur", players_per_side: 6, cost_per_head: 1500 };
    serve(opponent);
    render(<PostPage id="p1" now={NOW} />);

    expect(await screen.findByRole("heading", { level: 1, name: "FC Mirpur" })).toBeInTheDocument();
    expect(screen.getByText("Cost per team")).toBeInTheDocument();
    expect(screen.getByText("6-a-side")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /contact team/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /opponent lagbe/i })).toHaveAttribute("href", "/opponent-lagbe");
    expect(screen.queryByText(/keepers needed/i)).toBeNull();
  });

  it("asks a team for its details on requests-mode opponent posts", async () => {
    serve({ ...base, listing_type: "opponent_needed", team_name: "FC Mirpur", contact_mode: "requests" });
    render(<PostPage id="p1" now={NOW} />);
    expect(await screen.findByRole("heading", { name: /take them on/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/your team/i)).toBeInTheDocument();
  });

  it("asks keepers to send their number on requests-mode posts", async () => {
    serve({ ...base, contact_mode: "requests" });
    render(<PostPage id="p1" now={NOW} />);
    expect(await screen.findByRole("heading", { name: /i'm interested/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /contact host/i })).toBeNull();
  });

  it("hides contact actions once the game is filled", async () => {
    serve({ ...base, status: "filled" });
    render(<PostPage id="p1" now={NOW} />);
    expect(await screen.findByText(/host has found a keeper/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /contact host/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /share/i })).toBeNull();
  });

  it("hides contact actions once the match has started", async () => {
    serve({ ...base, start_datetime: "2026-10-01T11:00:00.000Z" });
    render(<PostPage id="p1" now={NOW} />);
    expect(await screen.findByText(/match has already started/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /contact host/i })).toBeNull();
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
