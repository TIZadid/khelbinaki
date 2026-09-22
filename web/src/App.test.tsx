import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ posts: [] }), { status: 200 })));
});
afterEach(() => vi.unstubAllGlobals());

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
