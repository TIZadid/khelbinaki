import type { PublicPost } from "./api";
import { formatDay, formatTime } from "./time";

export function postPath(id: string): string {
  return `/p/${id}`;
}

export function postUrl(id: string, origin: string): string {
  return `${origin}${postPath(id)}`;
}

function place(post: PublicPost): string {
  return post.turf_name ? `${post.turf_name}, ${post.area}` : post.area;
}

function when(post: PublicPost): string {
  const start = new Date(post.start_datetime);
  return `${formatDay(start)} at ${formatTime(start)}`;
}

export function whatsappContactUrl(post: PublicPost, origin: string): string {
  const text =
    `Hi ${post.host_name}, I saw your Khelbi Naki post for ${place(post)} on ${when(post)}. ` +
    `I can play in goal. Is the spot still open?\n${postUrl(post.id, origin)}`;
  return `https://wa.me/${post.phone}?text=${encodeURIComponent(text)}`;
}

export function whatsappShareUrl(post: PublicPost, origin: string): string {
  const cost = post.cost_per_head != null ? ` · ৳${post.cost_per_head}/head` : "";
  const text = `Need a keeper! ${place(post)} · ${when(post)}${cost}\n${postUrl(post.id, origin)}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function telUrl(phone: string): string {
  return `tel:+${phone}`;
}

// 8801712345678 -> +880 1712-345678
export function formatPhone(phone: string): string {
  const match = /^880(\d{4})(\d{6})$/.exec(phone);
  return match ? `+880 ${match[1]}-${match[2]}` : `+${phone}`;
}
