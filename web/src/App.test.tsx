import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { saveKeeperProfile } from "@/lib/keeper";
import App from "./App";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ posts: [] }), { status: 200 })));
});
afterEach(() => vi.unstubAllGlobals());
afterEach(() => window.history.pushState(null, "", "/"));

it("renders the brand, hero, both boards and three how-it-works steps", async () => {
  render(<App />);
  // brand is split across elements ("Khelbi " + <span>Naki?</span>), so check the header's text
  expect(screen.getByRole("banner")).toHaveTextContent("Khelbi Naki");
  expect(screen.getByRole("heading", { level: 1, name: /khelbi naki/i })).toBeInTheDocument();
  expect(await screen.findByText(/no games need a keeper/i)).toBeInTheDocument();
  expect(screen.getByText(/no teams are looking for a match/i)).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 2, name: /^gk lagbe$/i, hidden: false })).toBeInTheDocument();
  expect(document.getElementById("gk-lagbe")).not.toBeNull();
  expect(document.getElementById("opponent-lagbe")).not.toBeNull();
  const steps = screen.getByRole("list", { name: /how it works/i });
  expect(within(steps).getAllByRole("listitem")).toHaveLength(3);
});

it("fetches both boards in one request", async () => {
  render(<App />);
  await screen.findByText(/no games need a keeper/i);
  const calls = (fetch as unknown as { mock: { calls: [string][] } }).mock.calls;
  expect(calls.map(([url]) => url)).toEqual([expect.stringMatching(/\/posts\?type=all$/)]);
});

it("never calls a board 'open games'", async () => {
  const { container } = render(<App />);
  await screen.findByText(/no games need a keeper/i);
  expect(container).not.toHaveTextContent(/open games/i);
});

it("is not framed as night-only or Dhaka-only", () => {
  const { container } = render(<App />);
  expect(container).not.toHaveTextContent(/tonight/i);
  expect(container).not.toHaveTextContent(/dhaka/i);
});

it("draws the pitch background as decoration only", () => {
  const { container } = render(<App />);
  expect(container.querySelector('[data-testid="pitch-bg"]')).toHaveAttribute("aria-hidden", "true");
});

it("routes /p/:id to the post page", async () => {
  window.history.pushState(null, "", "/p/missing1");
  render(<App />);
  expect(await screen.findByText(/doesn't exist/i)).toBeInTheDocument();
});

it("shows a 404 page for unknown paths", () => {
  window.history.pushState(null, "", "/nope");
  render(<App />);
  expect(screen.getByRole("heading", { name: /page not found/i })).toBeInTheDocument();
});

it("routes /keeper to the keeper profile page", () => {
  window.history.pushState(null, "", "/keeper");
  render(<App />);
  expect(screen.getByRole("heading", { level: 1, name: /your keeper profile/i })).toBeInTheDocument();
});

it("links keepers to their profile from the header", () => {
  const { unmount } = render(<App />);
  expect(within(screen.getByRole("banner")).getByRole("link", { name: "I'm a keeper" })).toHaveAttribute("href", "/keeper");
  const banner = within(screen.getByRole("banner"));
  expect(banner.getByRole("link", { name: /need a keeper/i })).toHaveAttribute("href", "/new");
  expect(banner.getByRole("link", { name: /need an opponent/i })).toHaveAttribute("href", "/new/opponent");
  expect(banner.getByRole("link", { name: "GK Lagbe" })).toHaveAttribute("href", "/#gk-lagbe");
  expect(banner.getByRole("link", { name: "Opponent Lagbe" })).toHaveAttribute("href", "/#opponent-lagbe");
  unmount();
  saveKeeperProfile({ name: "Mehedi", phone: "8801912345678", regions: [], note: "" });
  render(<App />);
  expect(within(screen.getByRole("banner")).getByRole("link", { name: "My profile" })).toBeInTheDocument();
});

it("routes /new to the post form", () => {
  window.history.pushState(null, "", "/new");
  render(<App />);
  expect(screen.getByRole("heading", { level: 1, name: /need a keeper/i })).toBeInTheDocument();
});

it("routes /new/opponent to the opponent form", () => {
  window.history.pushState(null, "", "/new/opponent");
  render(<App />);
  expect(screen.getByRole("heading", { level: 1, name: /need an opponent/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/team name/i)).toBeInTheDocument();
  expect(screen.getByRole("group", { name: /how many a side/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/cost per team/i)).toBeInTheDocument();
  expect(screen.queryByRole("group", { name: /keepers needed/i })).toBeNull();
});

it("asks for the manage link when the token is missing", () => {
  window.history.pushState(null, "", "/p/abc123/manage");
  render(<App />);
  expect(screen.getByRole("heading", { level: 1, name: /manage link needed/i })).toBeInTheDocument();
});

it("routes /cha to the tip page", () => {
  window.history.pushState(null, "", "/cha");
  render(<App />);
  expect(screen.getByRole("heading", { level: 1, name: /buy me a cha/i })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /^bkash$/i })).toBeInTheDocument();
});
