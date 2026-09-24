import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadTelegramKeys } from "@/lib/alerts";
import { loadAlertPrefs } from "@/lib/alertPrefs";
import { saveKeeperProfile } from "@/lib/keeper";
import { AlertsPage } from "./AlertsPage";

function stubPush(subscribed = false) {
  const subscription = { endpoint: "https://push.example/sub", toJSON: () => ({ endpoint: "https://push.example/sub" }), unsubscribe: vi.fn() };
  const manager = { getSubscription: vi.fn(async () => (subscribed ? subscription : null)), subscribe: vi.fn(async () => subscription) };
  vi.stubGlobal("Notification", { permission: "default", requestPermission: vi.fn(async () => "granted") });
  vi.stubGlobal("PushManager", class {});
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { register: vi.fn(async () => ({ pushManager: manager })), getRegistration: vi.fn(async () => ({ pushManager: manager })), ready: Promise.resolve() },
  });
}

function stubApi() {
  const calls: { url: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (/\/alerts\/telegram\/[^/]+$/.test(url)) return new Response(JSON.stringify({ status: "linked", regions: "dhaka", board: "gk_needed" }));
      return new Response(JSON.stringify({ ok: true }));
    }),
  );
  return calls;
}

const board = (name: RegExp) => screen.getByRole("button", { name });

beforeEach(() => stubPush());
afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState(null, "", "/");
});

describe("AlertsPage", () => {
  it("starts on GK Lagbe in the keeper's places, and never lets both boards go off", () => {
    stubApi();
    saveKeeperProfile({ name: "Mehedi", phone: "", regions: ["dhaka"], note: "" });
    render(<AlertsPage />);

    expect(board(/^gk lagbe/i)).toHaveAttribute("aria-pressed", "true");
    expect(board(/^opponent lagbe/i)).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Remove Dhaka" })).toBeInTheDocument();

    fireEvent.click(board(/^gk lagbe/i));
    expect(board(/^gk lagbe/i)).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(board(/^opponent lagbe/i));
    fireEvent.click(board(/^gk lagbe/i));
    expect(board(/^gk lagbe/i)).toHaveAttribute("aria-pressed", "false");
    expect(loadAlertPrefs()).toEqual({ boards: ["opponent_needed"], regions: ["dhaka"] });
  });

  it("turns on the board a 'Get alerts' link asked for, with one Telegram row per board", () => {
    stubApi();
    window.history.pushState(null, "", "/alerts?board=opp");
    render(<AlertsPage />);
    expect(board(/^opponent lagbe/i)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /connect telegram for gk lagbe/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect telegram for opponent lagbe/i })).toBeInTheDocument();
  });

  it("moves alerts that are already on, and turns a bot off when its board is switched off", async () => {
    stubPush(true);
    const calls = stubApi();
    window.localStorage.setItem("khelbinaki.telegram.v2", JSON.stringify({ gk: { code: "gkcode", link: "l" } }));
    window.history.pushState(null, "", "/alerts?board=opp");
    render(<AlertsPage />);

    fireEvent.change(screen.getByLabelText(/districts or divisions/i), { target: { value: "sylhet" } });
    await waitFor(() =>
      expect(calls.find((c) => c.url.endsWith("/alerts/regions"))?.body).toEqual({
        endpoint: "https://push.example/sub",
        regions: ["sylhet"],
        boards: ["gk_needed", "opponent_needed"],
      }),
    );
    expect(calls.some((c) => c.url.endsWith("/alerts/telegram/gkcode/regions"))).toBe(true);
    expect(await screen.findByRole("status")).toHaveTextContent(/follow these choices/i);

    fireEvent.click(board(/^gk lagbe/i));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/alerts/telegram/gkcode/off"))).toBe(true));
    expect(loadTelegramKeys()).toEqual({});
  });

  it("shows a connected bot as on", async () => {
    stubApi();
    window.localStorage.setItem("khelbinaki.telegram.v2", JSON.stringify({ gk: { code: "gkcode", link: "l" } }));
    render(<AlertsPage />);
    const how = within(screen.getByRole("region", { name: /how\?/i }));
    expect(await how.findByText(/on\. watching dhaka/i)).toBeInTheDocument();
  });
});

describe("Telegram keys", () => {
  it("carries a key saved before Opponent Lagbe had a bot over as the GK key", () => {
    window.localStorage.setItem("khelbinaki.telegram.v1", JSON.stringify({ code: "old", link: "https://t.me/gklagbebot?start=old" }));
    expect(loadTelegramKeys()).toEqual({ gk: { code: "old", link: "https://t.me/gklagbebot?start=old" } });
    expect(window.localStorage.getItem("khelbinaki.telegram.v1")).toBeNull();
  });
});
