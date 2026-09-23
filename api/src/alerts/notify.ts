import { sendPush } from "../lib/webpush";
import { districtName } from "../lib/bd";
import type { PublicPost } from "../posts/repo";
import { deleteAlert, listAlertsFor } from "./repo";

export type NotifyEnv = {
  DB: D1Database;
  SITE_URL: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  TELEGRAM_BOT_TOKEN?: string;
};

/** What a keeper reads in Telegram when a game near them is posted. */
export function alertMessage(post: PublicPost, siteUrl: string): string {
  const where = [post.turf_name, post.area, districtName(post.district)].filter(Boolean).join(", ");
  const start = new Date(post.start_datetime);
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(start);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Dhaka", hour: "numeric", minute: "2-digit" })
    .format(start)
    .replace(/ /g, " ");
  const cost = post.cost_per_head != null ? ` · ৳${post.cost_per_head}/head` : "";
  return `Keeper needed: ${where} · ${day} ${time}${cost}\n${siteUrl}/p/${post.id}`;
}

async function sendTelegram(token: string, chatId: string, text: string, fetcher: typeof fetch): Promise<boolean> {
  const response = await fetcher(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  return response.ok;
}

/**
 * Tells every keeper watching this area. Failures are swallowed on purpose:
 * posting a game must never fail because a notification did.
 */
export async function notifyNewPost(
  env: NotifyEnv,
  post: PublicPost,
  fetcher: typeof fetch = (input, init) => fetch(input, init),
): Promise<{ sent: number; dropped: number }> {
  const alerts = await listAlertsFor(env.DB, post.district, post.division);
  let sent = 0;
  let dropped = 0;

  for (const alert of alerts) {
    try {
      if (alert.channel === "telegram") {
        if (!env.TELEGRAM_BOT_TOKEN) continue;
        if (await sendTelegram(env.TELEGRAM_BOT_TOKEN, alert.address, alertMessage(post, env.SITE_URL), fetcher)) {
          sent += 1;
        }
        continue;
      }

      if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) continue;
      const outcome = await sendPush(
        alert.address,
        {
          publicKey: env.VAPID_PUBLIC_KEY,
          privateKey: env.VAPID_PRIVATE_KEY,
          subject: env.VAPID_SUBJECT ?? env.SITE_URL,
        },
        fetcher,
      );
      if (outcome === "sent") sent += 1;
      if (outcome === "gone") {
        // The browser threw the subscription away; stop trying it.
        await deleteAlert(env.DB, "push", alert.address);
        dropped += 1;
      }
    } catch {
      // One bad subscription shouldn't stop the rest.
    }
  }

  return { sent, dropped };
}
