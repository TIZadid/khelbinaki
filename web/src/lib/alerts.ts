import { API_URL } from "./api";

export const VAPID_PUBLIC_KEY = "BBPgyWJg3ko3TwZp6gG9jAcs2bKvtqSLeO37ffIWGvXBURdLYX21xcuBLzdfXz59LXgUQ_vMrvJTAg561o3ArxQ";

export type AlertState = "unsupported" | "off" | "on" | "blocked";

function toUint8(base64url: string): Uint8Array {
  const padded = base64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64url.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** Asks permission, subscribes, and tells the API which areas to watch. */
export async function enablePush(regions: string[], turnstileToken: string): Promise<AlertState> {
  if (!pushSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "blocked" : "off";

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toUint8(VAPID_PUBLIC_KEY) as BufferSource,
    }));

  const response = await fetch(`${API_URL}/alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: subscription.toJSON(), regions, turnstile_token: turnstileToken }),
  });
  return response.ok ? "on" : "off";
}

export async function disablePush(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await fetch(`${API_URL}/alerts/off`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => undefined);
  await subscription.unsubscribe().catch(() => undefined);
}

/** Moves this browser's push alerts to new places. No-op when push is off here. */
export async function updatePushRegions(regions: string[]): Promise<boolean> {
  const subscription = await currentSubscription().catch(() => null);
  if (!subscription) return false;
  const response = await fetch(`${API_URL}/alerts/regions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint, regions }),
  }).catch(() => null);
  return response?.ok ?? false;
}

// Telegram: the link code is kept on this phone and acts as its private key to
// the chat's alerts (check them, change places, turn them off). No login.
export type TelegramKey = { code: string; link: string };
const TELEGRAM_KEY = "khelbinaki.telegram.v1";

export function loadTelegramKey(): TelegramKey | null {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(TELEGRAM_KEY) ?? "null");
    const key = parsed as TelegramKey | null;
    return key && typeof key.code === "string" && typeof key.link === "string" ? key : null;
  } catch {
    return null;
  }
}

export function saveTelegramKey(key: TelegramKey | null): void {
  try {
    if (key) window.localStorage.setItem(TELEGRAM_KEY, JSON.stringify(key));
    else window.localStorage.removeItem(TELEGRAM_KEY);
  } catch {
    // Storage blocked: the link still works, the site just can't show its status later.
  }
}

/** Gets a fresh t.me link that ties a Telegram chat to these places, and remembers it here. */
export async function telegramLink(regions: string[], turnstileToken: string): Promise<TelegramKey | null> {
  const response = await fetch(`${API_URL}/alerts/telegram`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ regions, turnstile_token: turnstileToken }),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { code?: string; link?: string };
  if (!data.code || !data.link) return null;
  const key = { code: data.code, link: data.link };
  saveTelegramKey(key);
  return key;
}

export type TelegramStatus =
  | { status: "unknown" }
  | { status: "waiting" }
  | { status: "linked"; regions: string }
  | { status: "stopped" };

export async function telegramStatus(code: string): Promise<TelegramStatus> {
  const response = await fetch(`${API_URL}/alerts/telegram/${encodeURIComponent(code)}`);
  if (!response.ok) throw new Error(`Telegram status failed (${response.status})`);
  return (await response.json()) as TelegramStatus;
}

export async function updateTelegramRegions(code: string, regions: string[]): Promise<boolean> {
  const response = await fetch(`${API_URL}/alerts/telegram/${encodeURIComponent(code)}/regions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ regions }),
  }).catch(() => null);
  return response?.ok ?? false;
}

export async function telegramOff(code: string): Promise<boolean> {
  const response = await fetch(`${API_URL}/alerts/telegram/${encodeURIComponent(code)}/off`, { method: "POST" }).catch(
    () => null,
  );
  return response?.ok ?? false;
}

/**
 * The keeper saved new places: move every alert this phone controls to them.
 * Returns how many channels followed (0 when no alerts are on).
 */
export async function syncAlertRegions(regions: string[]): Promise<number> {
  const key = loadTelegramKey();
  const results = await Promise.all([
    updatePushRegions(regions),
    key ? updateTelegramRegions(key.code, regions) : Promise.resolve(false),
  ]);
  if (results.some(Boolean)) window.dispatchEvent(new Event(ALERTS_CHANGED));
  return results.filter(Boolean).length;
}

/** Fired after places change, so the alerts panel re-reads its status. */
export const ALERTS_CHANGED = "khelbinaki:alerts-changed";
