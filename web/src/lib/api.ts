export type PostStatus = "open" | "filled" | "archived";
export type ContactMode = "direct" | "requests";

export type PublicPost = {
  id: string;
  listing_type: string;
  contact_mode: ContactMode;
  host_name: string;
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
