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
    fireEvent.change(screen.getByLabelText(/where do you play/i), { target: { value: "dhaka" } });
    type(/about you/i, "5 years in goal");
    fireEvent.click(screen.getByRole("button", { name: /save profile/i }));

    expect(screen.getByRole("status")).toHaveTextContent(/saved on this phone/i);
    expect(loadKeeperProfile()).toEqual({
      name: "Mehedi",
      phone: "8801912345678",
      regions: ["dhaka"],
      note: "5 years in goal",
    });
  });

  it("adds and removes places from the list", () => {
    render(<KeeperPage />);
    fireEvent.change(screen.getByLabelText(/where do you play/i), { target: { value: "coxs-bazar" } });
    expect(screen.getByRole("button", { name: "Remove Cox's Bazar" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/where do you play/i), { target: { value: "div-sylhet" } });
    expect(screen.getByRole("button", { name: "Remove All of Sylhet" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove Cox's Bazar" }));
    expect(screen.queryByRole("button", { name: "Remove Cox's Bazar" })).toBeNull();
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
    saveKeeperProfile({ name: "Mehedi", phone: "8801912345678", regions: ["dhaka"], note: "" });
    render(<KeeperPage />);
    expect(screen.getByLabelText(/your name/i)).toHaveValue("Mehedi");
    expect(screen.getByLabelText(/whatsapp number/i)).toHaveValue("01912-345678");
    expect(screen.getByRole("button", { name: "Remove Dhaka" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /delete profile/i }));
    expect(loadKeeperProfile()).toBeNull();
    expect(screen.getByLabelText(/your name/i)).toHaveValue("");
  });
});

describe("KeeperPage signed in with Telegram", () => {
  it("shows the account with its verified number, and Delete my data clears this phone too", async () => {
    const { vi } = await import("vitest");
    const { waitFor } = await import("@testing-library/react");
    window.localStorage.setItem("khelbinaki.session.v1", "s".repeat(43));
    saveKeeperProfile({ name: "Mehedi", phone: "8801912345678", regions: ["dhaka"], note: "" });
    const account = { name: "Mehedi", phone: "8801912345678", note: "", regions: ["dhaka"] };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) =>
        init?.method === "DELETE" ? new Response(JSON.stringify({ ok: true })) : new Response(JSON.stringify({ account, posts: [] })),
      ),
    );
    render(<KeeperPage />);

    expect(await screen.findByText(/signed in with telegram/i)).toBeInTheDocument();
    expect(await screen.findByText(/verified on telegram\. to change it/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/whatsapp number/i)).toHaveAttribute("readonly");

    fireEvent.click(screen.getByRole("button", { name: /delete my data/i }));
    fireEvent.click(screen.getByRole("button", { name: /yes, delete my data/i }));
    await waitFor(() => expect(window.localStorage.getItem("khelbinaki.session.v1")).toBeNull());
    expect(loadKeeperProfile()).toBeNull();
    expect(await screen.findByRole("heading", { name: /continue with telegram/i })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
