import { sendPush } from "../lib/webpush";
import { districtName } from "../lib/bd";
import type { PublicPost } from "../posts/repo";
import { type BotEnv, botsFor, sendTelegram } from "./bots";
import { deleteAlert, listAlertsFor } from "./repo";

export type NotifyEnv = BotEnv & {
  DB: D1Database;
  SITE_URL: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
};

/** What someone reads in Telegram when a post near them goes up. */
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
    .replace(/ /g, " ");
  const link = `${siteUrl}/p/${post.id}`;
  if (post.listing_type === "opponent_needed") {
    const format = post.players_per_side ? ` · ${post.players_per_side}-a-side` : "";
    const cost = post.cost_per_head != null ? ` · ৳${post.cost_per_head}/team` : "";
    return `Opponent needed: ${post.team_name ?? post.host_name}${format} · ${where} · ${day} ${time}${cost}\n${link}`;
  }
  const cost = post.cost_per_head != null ? ` · ৳${post.cost_per_head}/head` : "";
  return `Keeper needed: ${where} · ${day} ${time}${cost}\n${link}`;
}

/**
 * Tells everyone who wants this post's board and follows its place. Telegram
 * alerts go out through the bot they signed up with. Failures are swallowed on
 * purpose: posting must never fail because a notification did.
 */
export async function notifyNewPost(
  env: NotifyEnv,
  post: PublicPost,
  fetcher: typeof fetch = (input, init) => fetch(input, init),
): Promise<{ sent: number; dropped: number }> {
  const alerts = await listAlertsFor(env.DB, post.district, post.division, post.listing_type);
  const bots = botsFor(env);
  let sent = 0;
  let dropped = 0;

  for (const alert of alerts) {
    try {
      if (alert.channel === "telegram" || alert.channel === "telegram_opp") {
        const token = (alert.channel === "telegram_opp" ? bots.opp : bots.gk).token;
        if (!token) continue;
        const response = await sendTelegram(token, alert.address, alertMessage(post, env.SITE_URL), fetcher);
        if (response.ok) sent += 1;
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
