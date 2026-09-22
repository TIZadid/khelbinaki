import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { loadKeeperProfile, saveKeeperProfile } from "@/lib/keeper";
import { KeeperPage } from "./KeeperPage";

const type = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("KeeperPage", () => {
  it("saves a valid profile on this phone", () => {
    render(<KeeperPage />);
    type(/your name/i, "Mehedi");
    type(/whatsapp number/i, "019 1234 5678");
    type(/areas you play in/i, "Mirpur");
    fireEvent.click(screen.getByRole("button", { name: /add area/i }));
    type(/areas you play in/i, "Uttara"); // typed but not added: still saved
    type(/about you/i, "5 years in goal");
    fireEvent.click(screen.getByRole("button", { name: /save profile/i }));

    expect(screen.getByRole("status")).toHaveTextContent(/saved on this phone/i);
    expect(loadKeeperProfile()).toEqual({
      name: "Mehedi",
      phone: "8801912345678",
      areas: ["Mirpur", "Uttara"],
      note: "5 years in goal",
    });
  });

  it("adds areas with Enter and removes them", () => {
    render(<KeeperPage />);
    const areaInput = screen.getByLabelText(/areas you play in/i);
    fireEvent.change(areaInput, { target: { value: "Agrabad" } });
    fireEvent.keyDown(areaInput, { key: "Enter" });
    expect(screen.getByRole("button", { name: "Remove Agrabad" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove Agrabad" }));
    expect(screen.queryByRole("button", { name: "Remove Agrabad" })).toBeNull();
  });

  it("shows field errors and saves nothing", () => {
    render(<KeeperPage />);
    type(/whatsapp number/i, "123");
    fireEvent.click(screen.getByRole("button", { name: /save profile/i }));
    expect(screen.getByText("Tell hosts your name")).toBeInTheDocument();
    expect(screen.getByText(/bangladeshi mobile number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/whatsapp number/i)).toHaveAttribute("aria-invalid", "true");
    expect(loadKeeperProfile()).toBeNull();
  });

  it("prefills a saved profile and deletes it", () => {
    saveKeeperProfile({ name: "Mehedi", phone: "8801912345678", areas: ["Mirpur"], note: "" });
    render(<KeeperPage />);
    expect(screen.getByLabelText(/your name/i)).toHaveValue("Mehedi");
    expect(screen.getByLabelText(/whatsapp number/i)).toHaveValue("01912-345678");
    expect(screen.getByRole("button", { name: "Remove Mirpur" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /delete profile/i }));
    expect(loadKeeperProfile()).toBeNull();
    expect(screen.getByLabelText(/your name/i)).toHaveValue("");
  });
});
