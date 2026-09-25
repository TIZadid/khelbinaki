import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
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
  expect(screen.getByRole("heading", { level: 2, name: /^gk lagbe/i })).toBeInTheDocument();
  expect(document.getElementById("gk-lagbe")).not.toBeNull();
  expect(document.getElementById("opponent-lagbe")).not.toBeNull();
  const steps = screen.getByRole("list", { name: /how it works/i });
  expect(within(steps).getAllByRole("listitem")).toHaveLength(3);
});

it("fetches both boards in one request", async () => {
  render(<App />);
  await screen.findByText(/no games need a keeper/i);
  const calls = (fetch as unknown as { mock: { calls: [string][] } }).mock.calls;
  // Posts come in one request for both boards (the keeper count is fetched separately).
  expect(calls.map(([url]) => url).filter((url) => url.includes("/posts"))).toEqual([expect.stringMatching(/\/posts\?type=all$/)]);
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

it("links every main place from the header, marking where you are", () => {
  window.history.pushState(null, "", "/gk-lagbe");
  render(<App />);
  const banner = within(screen.getByRole("banner"));
  expect(banner.getByRole("link", { name: /need a keeper/i })).toHaveAttribute("href", "/new");
  expect(banner.getByRole("link", { name: /need an opponent/i })).toHaveAttribute("href", "/new/opponent");
  expect(banner.getByRole("link", { name: "GK Lagbe" })).toHaveAttribute("aria-current", "page");
  expect(banner.getByRole("link", { name: "Opponent Lagbe" })).toHaveAttribute("href", "/opponent-lagbe");
  expect(banner.getByRole("link", { name: "Opponent Lagbe" })).not.toHaveAttribute("aria-current");
  expect(banner.getByRole("link", { name: "Me" })).toHaveAttribute("href", "/me");
  expect(banner.getByRole("link", { name: "Help" })).toHaveAttribute("href", "/help");
});

it("has a phone tab bar with icon-and-word tabs, lighting the current one", () => {
  window.history.pushState(null, "", "/alerts");
  render(<App />);
  const tabs = screen.getAllByRole("navigation", { name: "Main" }).find((nav) => nav.querySelector("ul.grid")) as HTMLElement;
  const alerts = within(tabs).getByRole("link", { name: /alerts/i });
  expect(alerts).toHaveAttribute("aria-current", "page");
  expect(within(tabs).getAllByRole("link").map((a) => a.textContent)).toEqual(["Home", "GK Lagbe", "Opponent", "Alerts", "Me"]);
});

it("gives each board its own page, with breadcrumbs, search and a page title", async () => {
  window.history.pushState(null, "", "/opponent-lagbe");
  render(<App />);
  expect(screen.getByRole("heading", { level: 1, name: /opponent lagbe/i })).toBeInTheDocument();
  const crumbs = within(screen.getByRole("navigation", { name: "Breadcrumb" }));
  expect(crumbs.getByRole("link", { name: /home/i })).toHaveAttribute("href", "/");
  expect(crumbs.getByText("Opponent Lagbe")).toHaveAttribute("aria-current", "page");
  expect(document.title).toMatch(/^Opponent Lagbe — Khelbi Naki/);
});

it("shows only a preview of each board on the home page, with a way to see all", async () => {
  render(<App />);
  await screen.findByText(/no games need a keeper/i);
  expect(screen.getByRole("heading", { level: 2, name: /^gk lagbe/i })).toBeInTheDocument();
  // Each board card on top is one big tap target to its board.
  expect(screen.getByRole("link", { name: "Open GK Lagbe" })).toHaveAttribute("href", "/gk-lagbe");
  expect(screen.getByRole("link", { name: "Open Opponent Lagbe" })).toHaveAttribute("href", "/opponent-lagbe");
});

it("routes /me to a hub of your things", () => {
  window.history.pushState(null, "", "/me");
  render(<App />);
  expect(screen.getByRole("heading", { level: 1, name: "Me" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /keeper profile/i })).toHaveAttribute("href", "/keeper");
  expect(screen.getByRole("link", { name: /my posts/i })).toHaveAttribute("href", "/my-posts");
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
