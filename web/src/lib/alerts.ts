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
export async function enablePush(areas: string[], turnstileToken: string): Promise<AlertState> {
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
    body: JSON.stringify({ subscription: subscription.toJSON(), areas, turnstile_token: turnstileToken }),
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

/** Returns the t.me link that ties this keeper's Telegram chat to their areas. */
export async function telegramLink(areas: string[], turnstileToken: string): Promise<string | null> {
  const response = await fetch(`${API_URL}/alerts/telegram`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ areas, turnstile_token: turnstileToken }),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { link?: string };
  return data.link ?? null;
}
