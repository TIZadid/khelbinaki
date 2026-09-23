import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicPost } from "@/lib/api";
import { saveKeeperProfile } from "@/lib/keeper";
import { ContactSheet } from "./ContactSheet";
import { InterestForm } from "./InterestForm";

const post: PublicPost = {
  id: "p1",
  listing_type: "gk_needed",
  contact_mode: "direct",
  host_name: "Rafi",
  area: "Mirpur",
  district: "dhaka",
  division: "div-dhaka",
  turf_name: "Kings Arena",
  start_datetime: "2026-10-01T13:30:00.000Z",
  duration_minutes: 60,
  cost_per_head: 150,
  slots_needed: 1,
  notes: null,
  status: "open",
  created_at: "2026-10-01 08:00:00",
};

// The real widget calls back with a one-use token; here it fires immediately.
function stubTurnstile(token = "tok") {
  vi.stubGlobal("turnstile", {
    render: (_el: HTMLElement, opts: { callback: (t: string) => void }) => {
      opts.callback(token);
      return "widget-1";
    },
    remove: () => {},
  });
}

function stubFetch(reply: unknown, status = 200) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(reply), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => stubTurnstile());
afterEach(() => vi.unstubAllGlobals());

describe("ContactSheet", () => {
  it("reveals the host's number after the spam check", async () => {
    const fetchMock = stubFetch({ phone: "8801712345678" });
    render(<ContactSheet post={post} onClose={vi.fn()} />);

    expect(await screen.findByText("01712-345678")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/posts\/p1\/contact$/);
    expect(screen.getByRole("link", { name: /whatsapp rafi/i }).getAttribute("href")).toMatch(
      /^https:\/\/wa\.me\/8801712345678\?text=/,
    );
    expect(screen.getByRole("link", { name: /^call/i })).toHaveAttribute("href", "tel:+8801712345678");
  });

  it("explains when the game has closed", async () => {
    stubFetch({ error: "closed" }, 410);
    render(<ContactSheet post={post} onClose={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/no longer taking keepers/i);
  });
});

describe("InterestForm", () => {
  const requestsPost = { ...post, contact_mode: "requests" as const, host_name: "Nabil" };

  it("pre-fills from the keeper profile and sends the request", async () => {
    saveKeeperProfile({ name: "Mehedi", phone: "8801912345678", regions: ["dhaka"], note: "5 yrs in goal" });
    const fetchMock = stubFetch({ ok: true }, 201);
    render(<InterestForm post={requestsPost} />);

    expect(screen.getByLabelText(/your name/i)).toHaveValue("Mehedi");
    expect(screen.getByLabelText(/whatsapp number/i)).toHaveValue("01912-345678");
    // The button unlocks once the spam check hands over a token.
    fireEvent.click(await screen.findByRole("button", { name: /send to nabil/i }));

    expect(await screen.findByRole("heading", { name: /sent to nabil/i })).toBeInTheDocument();
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body ?? "{}"))).toMatchObject({
      name: "Mehedi",
      phone: "8801912345678",
      note: "5 yrs in goal",
      turnstile_token: "tok",
    });
  });

  it("checks the fields before sending", async () => {
    const fetchMock = stubFetch({ ok: true }, 201);
    render(<InterestForm post={requestsPost} />);

    fireEvent.change(screen.getByLabelText(/whatsapp number/i), { target: { value: "123" } });
    fireEvent.click(await screen.findByRole("button", { name: /send to nabil/i }));

    expect(screen.getByText("Tell the host your name")).toBeInTheDocument();
    expect(screen.getByText(/bangladeshi mobile number/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
