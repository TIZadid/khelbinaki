// Facebook, Messenger and WhatsApp show a link's preview card, ignoring any text
// typed with it. These tags make each game's link describe that game.
export type MetaPost = {
  area: string;
  district?: string;
  turf_name: string | null;
  start_datetime: string;
  cost_per_head: number | null;
  duration_minutes: number | null;
  slots_needed: number;
  status: string;
};

import { districtName } from "./bd";

const TZ = "Asia/Dhaka";

const districtLabel = (slug?: string) => (slug ? districtName(slug) : null);

function whenLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).format(date);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" })
    .format(date)
    .replace(/ /g, " ");
  return `${day} ${time}`;
}

export function buildMeta(post: MetaPost, url: string): { title: string; description: string; url: string } {
  const place = [post.turf_name, post.area, districtLabel(post.district)].filter(Boolean).join(", ");
  const filled = post.status === "filled";
  const title = `${filled ? "Filled" : "Keeper needed"} · ${place} · ${whenLabel(post.start_datetime)}`;
  const bits = [
    post.cost_per_head != null ? `৳${post.cost_per_head} per head` : "Cost: ask the host",
    post.duration_minutes ? `${post.duration_minutes} min` : "",
    post.slots_needed > 1 ? `${post.slots_needed} keepers needed` : "",
    filled ? "This game is filled." : "Tap to contact the host on Khelbi Naki.",
  ].filter(Boolean);
  return { title, description: bits.join(" · "), url };
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
