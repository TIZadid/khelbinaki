// Edit tokens for posts made on this device. Losing them means losing control of
// the post, so the manage link also carries the token in its hash.
const STORAGE_KEY = "khelbinaki.posts.v1";

export type MyPost = { id: string; token: string };

export function loadMyPosts(): MyPost[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is MyPost => typeof p === "object" && p !== null && typeof (p as MyPost).id === "string" && typeof (p as MyPost).token === "string",
    );
  } catch {
    return [];
  }
}

export function rememberMyPost(post: MyPost): void {
  try {
    const others = loadMyPosts().filter((p) => p.id !== post.id);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([post, ...others].slice(0, 20)));
  } catch {
    // Storage blocked: the manage link in the URL is the fallback.
  }
}

export function tokenForPost(id: string): string | null {
  return loadMyPosts().find((p) => p.id === id)?.token ?? null;
}

export function forgetMyPost(id: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(loadMyPosts().filter((p) => p.id !== id)));
  } catch {
    // Storage blocked: nothing was remembered here anyway.
  }
}

/** `fresh` marks the link the host lands on right after posting (it asks them to save it). */
export function managePath(id: string, token: string, fresh = false): string {
  return `/p/${id}/manage#t=${token}${fresh ? "&new=1" : ""}`;
}
