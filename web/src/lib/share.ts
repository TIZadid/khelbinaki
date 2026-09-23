import type { PublicPost } from "./api";
import { districtName } from "./bd";
import { postUrl } from "./contact";
import { formatDay, formatTime } from "./time";

/** One line that reads well in a group chat or a Facebook post. */
export function shareText(post: PublicPost): string {
  const start = new Date(post.start_datetime);
  const place = [post.turf_name, post.area, districtName(post.district)].filter(Boolean).join(", ");
  const cost = post.cost_per_head != null ? ` · ৳${post.cost_per_head}/head` : "";
  return `Need a keeper! ${place} · ${formatDay(start)} at ${formatTime(start)}${cost}`;
}

export type ShareTarget = { key: string; label: string; href: string };

/**
 * Desktop fallbacks. Facebook and Messenger ignore prefilled text and show the
 * link's preview card instead, so only the URL is passed to them.
 */
export function shareTargets(post: PublicPost, origin: string): ShareTarget[] {
  const url = postUrl(post.id, origin);
  const text = shareText(post);
  return [
    { key: "whatsapp", label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}` },
    { key: "facebook", label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    {
      key: "telegram",
      label: "Telegram",
      href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    },
  ];
}

/** True when the browser can open the phone's own share sheet. */
export function canUseShareSheet(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export async function openShareSheet(post: PublicPost, origin: string): Promise<boolean> {
  try {
    await navigator.share({ title: "Khelbi Naki", text: shareText(post), url: postUrl(post.id, origin) });
    return true;
  } catch {
    // Cancelled, or the browser refused: fall back to the buttons.
    return false;
  }
}
