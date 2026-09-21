import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import App from "./App";

it("renders the brand", () => {
  render(<App />);
  expect(screen.getByText("Khelbi Naki")).toBeInTheDocument();
});
