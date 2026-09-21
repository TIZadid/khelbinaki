import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GlowCard } from "./GlowCard";

describe("GlowCard", () => {
  it("tracks the cursor position in CSS variables", () => {
    render(<GlowCard>content</GlowCard>);
    const card = screen.getByText("content");
    fireEvent.mouseMove(card, { clientX: 30, clientY: 40 });
    expect(card.style.getPropertyValue("--mx")).toBe("30px");
    expect(card.style.getPropertyValue("--my")).toBe("40px");
  });

  it("uses the solid lime style when highlighted", () => {
    render(<GlowCard highlighted>hot</GlowCard>);
    expect(screen.getByText("hot")).toHaveClass("bg-primary");
  });
});
