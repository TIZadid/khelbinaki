import type { ListingType } from "./listing";

export type PostStatus = "open" | "filled" | "archived";
export type ContactMode = "direct" | "requests";

export type PublicPost = {
  id: string;
  listing_type: ListingType;
  team_name: string | null;
  players_per_side: number | null;
  contact_mode: ContactMode;
  host_name: string;
  area: string;
  district: string;
  division: string;
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

/** Both boards in one request; pages split them by listing_type. */
export async function fetchFeed(signal?: AbortSignal): Promise<PublicPost[]> {
  const res = await fetch(`${API_URL}/posts?type=all`, { signal });
  if (!res.ok) throw new Error(`Feed request failed (${res.status})`);
  const data = (await res.json()) as { posts: PublicPost[] };
  return data.posts;
}

export async function fetchPost(id: string, signal?: AbortSignal): Promise<PublicPost | null> {
  const res = await fetch(`${API_URL}/posts/${encodeURIComponent(id)}`, { signal });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Post request failed (${res.status})`);
  const data = (await res.json()) as { post?: PublicPost };
  return data.post ?? null;
}

export type ApiFailure = { error: string; fields?: Record<string, string> };

async function postJson(path: string, body: unknown): Promise<{ ok: true; data: unknown } | { ok: false; failure: ApiFailure }> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.ok) return { ok: true, data };
  return { ok: false, failure: { error: String(data.error ?? "failed"), fields: data.fields as Record<string, string> | undefined } };
}

/** Direct-contact posts: swap a Turnstile token for the host's phone. */
export async function revealPhone(id: string, turnstileToken: string) {
  const result = await postJson(`/posts/${encodeURIComponent(id)}/contact`, { turnstile_token: turnstileToken });
  return result.ok ? { ok: true as const, phone: String((result.data as { phone: string }).phone) } : result;
}

/** Requests posts: leave the keeper's details for the host. */
export async function sendInterest(
  id: string,
  interest: { name: string; phone: string; note: string; turnstile_token: string },
) {
  const result = await postJson(`/posts/${encodeURIComponent(id)}/interests`, interest);
  return result.ok ? { ok: true as const } : result;
}

export type NewPostInput = {
  listing_type: ListingType;
  team_name?: string;
  players_per_side: number;
  host_name: string;
  phone: string;
  area: string;
  district: string;
  turf_name?: string;
  start_datetime: string;
  duration_minutes?: number;
  cost_per_head?: number;
  slots_needed: number;
  notes?: string;
  contact_mode: ContactMode;
  turnstile_token: string;
};

export async function createPost(input: NewPostInput) {
  const result = await postJson("/posts", input);
  if (!result.ok) return result;
  const data = result.data as { post: PublicPost; edit_token: string };
  return { ok: true as const, post: data.post, editToken: data.edit_token };
}

export type Interest = { name: string; phone: string; note: string | null; created_at: string };

/** Host-only: the edit token proves ownership. */
export async function fetchInterests(id: string, editToken: string, signal?: AbortSignal): Promise<Interest[]> {
  const res = await fetch(`${API_URL}/posts/${encodeURIComponent(id)}/interests`, {
    headers: { Authorization: `Bearer ${editToken}` },
    signal,
  });
  if (!res.ok) throw new Error(`Interests request failed (${res.status})`);
  const data = (await res.json()) as { interests: Interest[] };
  return data.interests;
}

export async function setPostStatus(id: string, editToken: string, status: "open" | "filled") {
  const res = await fetch(`${API_URL}/posts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ edit_token: editToken, status }),
  });
  if (!res.ok) throw new Error(`Status update failed (${res.status})`);
  const data = (await res.json()) as { post: PublicPost };
  return data.post;
}

/** Host-only. "gone" when the post was already deleted (by the host or the hourly cleanup). */
export async function deletePost(id: string, editToken: string): Promise<"deleted" | "gone"> {
  const res = await fetch(`${API_URL}/posts/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${editToken}` },
  });
  if (res.status === 404) return "gone";
  if (!res.ok) throw new Error(`Delete failed (${res.status})`);
  return "deleted";
}

/** How many keepers get GK Lagbe alerts. */
export async function fetchStats(signal?: AbortSignal): Promise<{ keepers: number }> {
  const res = await fetch(`${API_URL}/stats`, { signal });
  if (!res.ok) throw new Error(`Stats request failed (${res.status})`);
  return (await res.json()) as { keepers: number };
}
