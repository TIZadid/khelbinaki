import { API_URL } from "./api";
import type { ListingType } from "./listing";

export const VAPID_PUBLIC_KEY = "BBPgyWJg3ko3TwZp6gG9jAcs2bKvtqSLeO37ffIWGvXBURdLYX21xcuBLzdfXz59LXgUQ_vMrvJTAg561o3ArxQ";

export type AlertState = "unsupported" | "off" | "on" | "blocked";

/** Each board has its own Telegram bot: "gk" is @gklagbebot, "opp" is @opponentlagbebot. */
export type BotKey = "gk" | "opp";
export const botOf = (board: ListingType): BotKey => (board === "opponent_needed" ? "opp" : "gk");
export const boardOf = (bot: BotKey): ListingType => (bot === "opp" ? "opponent_needed" : "gk_needed");

/** Fired whenever alert choices change, so every panel re-reads its status. */
export const ALERTS_CHANGED = "khelbinaki:alerts-changed";

function toUint8(base64url: string): Uint8Array {
  const padded = base64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64url.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

const postJson = (path: string, body: unknown) =>
  fetch(`${API_URL}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** Asks permission, subscribes, and tells the API which boards and places to watch. */
export async function enablePush(regions: string[], boards: ListingType[], turnstileToken: string): Promise<AlertState> {
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

  const response = await postJson("/alerts", { subscription: subscription.toJSON(), regions, boards, turnstile_token: turnstileToken });
  return response.ok ? "on" : "off";
}

export async function disablePush(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await postJson("/alerts/off", { endpoint: subscription.endpoint }).catch(() => undefined);
  await subscription.unsubscribe().catch(() => undefined);
}

/** Moves this browser's push alert to new boards and places. False when push is off here. */
export async function updatePushAlert(regions: string[], boards: ListingType[]): Promise<boolean> {
  const subscription = await currentSubscription().catch(() => null);
  if (!subscription) return false;
  const response = await postJson("/alerts/regions", { endpoint: subscription.endpoint, regions, boards }).catch(() => null);
  return response?.ok ?? false;
}

// Telegram: each bot's link code is kept on this phone and is its private key to
// that chat's alerts (check them, change places, turn them off). No login.
export type TelegramKey = { code: string; link: string };
export type TelegramKeys = Partial<Record<BotKey, TelegramKey>>;
const TELEGRAM_KEYS = "khelbinaki.telegram.v2";
const LEGACY_TELEGRAM_KEY = "khelbinaki.telegram.v1"; // before Opponent Lagbe had a bot: always GK

const isKey = (value: unknown): value is TelegramKey =>
  typeof value === "object" && value !== null && typeof (value as TelegramKey).code === "string" && typeof (value as TelegramKey).link === "string";

export function loadTelegramKeys(): TelegramKeys {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(TELEGRAM_KEYS) ?? "null");
    if (stored && typeof stored === "object") {
      const keys = stored as Record<string, unknown>;
      return { ...(isKey(keys.gk) ? { gk: keys.gk } : {}), ...(isKey(keys.opp) ? { opp: keys.opp } : {}) };
    }
    const legacy: unknown = JSON.parse(window.localStorage.getItem(LEGACY_TELEGRAM_KEY) ?? "null");
    if (isKey(legacy)) {
      const keys = { gk: legacy };
      window.localStorage.setItem(TELEGRAM_KEYS, JSON.stringify(keys));
      window.localStorage.removeItem(LEGACY_TELEGRAM_KEY);
      return keys;
    }
  } catch {
    // Storage blocked or garbled: act as if nothing is connected.
  }
  return {};
}

export function saveTelegramKey(bot: BotKey, key: TelegramKey | null): void {
  try {
    const keys = loadTelegramKeys();
    if (key) keys[bot] = key;
    else delete keys[bot];
    window.localStorage.setItem(TELEGRAM_KEYS, JSON.stringify(keys));
  } catch {
    // Storage blocked: the link still works, the site just can't show its status later.
  }
}

/** Gets a fresh t.me link to this board's bot for these places, and remembers it here. */
export async function telegramLink(regions: string[], bot: BotKey, turnstileToken: string): Promise<TelegramKey | "unavailable" | null> {
  const response = await postJson("/alerts/telegram", { regions, board: boardOf(bot), turnstile_token: turnstileToken }).catch(() => null);
  if (response?.status === 503) return "unavailable";
  if (!response?.ok) return null;
  const data = (await response.json()) as { code?: string; link?: string };
  if (!data.code || !data.link) return null;
  const key = { code: data.code, link: data.link };
  saveTelegramKey(bot, key);
  return key;
}

export type TelegramStatus =
  | { status: "unknown" }
  | { status: "waiting"; board: ListingType }
  | { status: "linked"; regions: string; board: ListingType }
  | { status: "stopped"; board: ListingType };

export async function telegramStatus(code: string): Promise<TelegramStatus> {
  const response = await fetch(`${API_URL}/alerts/telegram/${encodeURIComponent(code)}`);
  if (!response.ok) throw new Error(`Telegram status failed (${response.status})`);
  return (await response.json()) as TelegramStatus;
}

export async function updateTelegramRegions(code: string, regions: string[]): Promise<boolean> {
  const response = await postJson(`/alerts/telegram/${encodeURIComponent(code)}/regions`, { regions }).catch(() => null);
  return response?.ok ?? false;
}

export async function telegramOff(code: string): Promise<boolean> {
  const response = await postJson(`/alerts/telegram/${encodeURIComponent(code)}/off`, {}).catch(() => null);
  return response?.ok ?? false;
}

/**
 * Alert choices changed on this phone: move the push alert to the new boards and
 * places, move each connected bot to the new places, and turn off a bot whose
 * board was switched off. Returns how many alerts followed.
 */
export async function syncAlerts(prefs: { boards: ListingType[]; regions: string[] }): Promise<number> {
  const keys = loadTelegramKeys();
  const jobs: Promise<boolean>[] = [updatePushAlert(prefs.regions, prefs.boards)];
  for (const bot of ["gk", "opp"] as const) {
    const key = keys[bot];
    if (!key) continue;
    if (prefs.boards.includes(boardOf(bot))) jobs.push(updateTelegramRegions(key.code, prefs.regions));
    else
      jobs.push(
        telegramOff(key.code).then((ok) => {
          saveTelegramKey(bot, null);
          return ok;
        }),
      );
  }
  const results = await Promise.all(jobs);
  window.dispatchEvent(new Event(ALERTS_CHANGED));
  return results.filter(Boolean).length;
}
