import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import App from "./App";

it("renders the brand, hero and three how-it-works steps", () => {
  render(<App />);
  // brand is split across elements ("Khelbi " + <span>Naki?</span>), so check the header's text
  expect(screen.getByRole("banner")).toHaveTextContent("Khelbi Naki");
  expect(screen.getByRole("heading", { level: 1, name: /need a keeper/i })).toBeInTheDocument();
  expect(screen.getAllByRole("listitem")).toHaveLength(3);
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
