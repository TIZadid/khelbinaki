export type PostStatus = "open" | "filled" | "archived";

export type PublicPost = {
  id: string;
  listing_type: string;
  host_name: string;
  phone: string;
  area: string;
  turf_name: string | null;
  start_datetime: string;
  duration_minutes: number | null;
  cost_per_head: number | null;
  slots_needed: number;
  notes: string | null;
  status: PostStatus;
  created_at: string;
};

export const API_URL: string = import.meta.env.VITE_API_URL ?? "https://khelbinaki-api.zlabz.workers.dev";

export async function fetchFeed(signal?: AbortSignal): Promise<PublicPost[]> {
  const res = await fetch(`${API_URL}/posts`, { signal });
  if (!res.ok) throw new Error(`Feed request failed (${res.status})`);
  const data = (await res.json()) as { posts: PublicPost[] };
  return data.posts;
}
