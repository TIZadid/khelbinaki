import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { saveKeeperProfile } from "@/lib/keeper";
import App from "./App";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ posts: [] }), { status: 200 })));
});
afterEach(() => vi.unstubAllGlobals());
afterEach(() => window.history.pushState(null, "", "/"));

it("renders the brand, hero, feed and three how-it-works steps", async () => {
  render(<App />);
  // brand is split across elements ("Khelbi " + <span>Naki?</span>), so check the header's text
  expect(screen.getByRole("banner")).toHaveTextContent("Khelbi Naki");
  expect(screen.getByRole("heading", { level: 1, name: /need a keeper/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /see open games/i })).toHaveAttribute("href", "#games");
  expect(await screen.findByText(/no upcoming games/i)).toBeInTheDocument();
  const steps = screen.getByRole("list", { name: /how it works/i });
  expect(within(steps).getAllByRole("listitem")).toHaveLength(3);
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
  unmount();
  saveKeeperProfile({ name: "Mehedi", phone: "8801912345678", areas: [], note: "" });
  render(<App />);
  expect(within(screen.getByRole("banner")).getByRole("link", { name: "My profile" })).toBeInTheDocument();
});
