import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AlertSettings } from "./AlertSettings";

function stubTurnstile(token = "tok") {
  vi.stubGlobal("turnstile", {
    render: (_el: HTMLElement, opts: { callback: (t: string) => void }) => {
      opts.callback(token);
      return "widget";
    },
    remove: () => {},
  });
}

function stubPushSupport({ permission = "default" as NotificationPermission, subscribed = false } = {}) {
  const subscription = {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc",
    toJSON: () => ({ endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: {} }),
    unsubscribe: vi.fn(async () => true),
  };
  const manager = {
    getSubscription: vi.fn(async () => (subscribed ? subscription : null)),
    subscribe: vi.fn(async () => subscription),
  };
  vi.stubGlobal("Notification", { permission, requestPermission: vi.fn(async () => "granted") });
  vi.stubGlobal("PushManager", class {});
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      register: vi.fn(async () => ({ pushManager: manager })),
      getRegistration: vi.fn(async () => ({ pushManager: manager })),
      ready: Promise.resolve({ pushManager: manager }),
    },
  });
  return { manager, subscription };
}

function stubFetch(ok = true) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) =>
    ok ? new Response(JSON.stringify({ ok: true, link: "https://t.me/khelbinaki_bot?start=abc" }), { status: 200 }) : new Response("{}", { status: 500 }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => stubTurnstile());
afterEach(() => vi.unstubAllGlobals());

describe("AlertSettings", () => {
  it("subscribes this device to games in the keeper's areas", async () => {
    const { manager } = stubPushSupport();
    const fetchMock = stubFetch();
    render(<AlertSettings regions={["div-dhaka", "coxs-bazar"]} />);

    expect(screen.getByText(/All of Dhaka, Cox's Bazar/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /turn on/i }));

    expect(await screen.findByRole("button", { name: /turn off/i })).toBeInTheDocument();
    expect(manager.subscribe).toHaveBeenCalled();
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body ?? "{}"));
    expect(body).toMatchObject({ regions: ["div-dhaka", "coxs-bazar"], turnstile_token: "tok" });
  });

  it("hands over a Telegram link", async () => {
    stubPushSupport();
    stubFetch();
    render(<AlertSettings regions={[]} />);

    fireEvent.click(screen.getByRole("button", { name: /connect/i }));
    const link = await screen.findByRole("link", { name: /open telegram/i });
    expect(link).toHaveAttribute("href", "https://t.me/khelbinaki_bot?start=abc");
  });

  it("says when the browser blocks notifications", async () => {
    stubPushSupport({ permission: "denied" });
    render(<AlertSettings regions={["dhaka"]} />);

    expect(await screen.findByText(/blocked in your browser settings/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /turn on/i })).toBeDisabled();
  });
});
