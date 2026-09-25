import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HelpPage } from "./HelpPage";

describe("HelpPage", () => {
  it("opens an answer when its question is tapped", () => {
    render(<HelpPage />);
    const question = screen.getByRole("button", { name: /who can see my phone number/i });
    expect(question).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(question);
    expect(question).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/numbers are never listed on the board/i)).toBeInTheDocument();
  });

  it("finds answers by words people use, and says when nothing matches", () => {
    render(<HelpPage />);
    fireEvent.change(screen.getByLabelText(/search help/i), { target: { value: "lost" } });
    expect(screen.getByRole("button", { name: /i lost my manage link/i })).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByRole("button", { name: /does it cost anything/i })).toBeNull();

    fireEvent.change(screen.getByLabelText(/search help/i), { target: { value: "zzzz" } });
    expect(screen.getByText(/no answer matches/i)).toBeInTheDocument();
  });
});
