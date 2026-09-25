import { API_URL } from "./api";
import { type KeeperProfile, loadKeeperProfile, saveKeeperProfile } from "./keeper";
import { rememberMyPost } from "./myPosts";

// Optional "Continue with Telegram" accounts. The browser keeps a session token;
// the account (name, verified phone, places, note) and owned posts live on the
// server, so they follow the person to any device.

export type Account = { name: string; phone: string | null; note: string; regions: string[] };
export type OwnedPost = { id: string; token: string };

const SESSION_KEY = "khelbinaki.session.v1";
const CHANGE_EVENT = "khelbinaki:session";

export function readSession(): string | null {
  try {
    return window.localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function setSession(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(SESSION_KEY, token);
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage blocked: signed in for this page only.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeSession(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Headers that tie a request (like a new post) to the signed-in account, if any. */
export function authHeaders(): Record<string, string> {
  const session = readSession();
  return session ? { Authorization: `Bearer ${session}` } : {};
}

const request = (path: string, init: RequestInit = {}) =>
  fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(init.headers as Record<string, string>) },
  });

export type SignInLinks = { code: string; links: { gk: string | null; opp: string | null } };

export async function startSignIn(turnstileToken: string): Promise<SignInLinks | null> {
  const res = await request("/auth/start", { method: "POST", body: JSON.stringify({ turnstile_token: turnstileToken }) }).catch(() => null);
  return res?.ok ? ((await res.json()) as SignInLinks) : null;
}

/**
 * Once signed in on the server, bring what this phone already knows along: gaps in
 * the account are filled from the local profile, then the local profile mirrors the
 * account, and the account's posts join My posts here.
 */
async function adopt(session: string, account: Account): Promise<Account> {
  setSessionQuietly(session);
  const local = loadKeeperProfile();
  let merged = account;
  if (local && ((account.regions.length === 0 && local.regions.length > 0) || (!account.note && local.note))) {
    merged =
      (await saveAccount({
        name: account.name || local.name,
        note: account.note || local.note,
        regions: account.regions.length > 0 ? account.regions : local.regions,
      })) ?? account;
  }
  mirrorLocally(merged, local);
  const me = await fetchMe();
  for (const post of me?.posts ?? []) rememberMyPost(post);
  setSession(session);
  return merged;
}

// The session must be readable by adopt()'s own requests before anyone is told.
function setSessionQuietly(token: string) {
  try {
    window.localStorage.setItem(SESSION_KEY, token);
  } catch {
    // ignore
  }
}

/** The local keeper profile follows the account (so forms prefill as before). */
export function mirrorLocally(account: Account, local: KeeperProfile | null = loadKeeperProfile()) {
  saveKeeperProfile({
    name: account.name || local?.name || "",
    phone: account.phone ?? local?.phone ?? "",
    regions: account.regions.length > 0 ? account.regions : (local?.regions ?? []),
    note: account.note || local?.note || "",
  });
}

export async function pollSignIn(code: string): Promise<"waiting" | "expired" | Account> {
  const res = await fetch(`${API_URL}/auth/poll/${encodeURIComponent(code)}`).catch(() => null);
  if (!res) return "waiting"; // offline blip: keep waiting
  if (res.status === 404) return "expired";
  const data = (await res.json()) as { status?: string; session?: string; account?: Account };
  if (data.session && data.account) return adopt(data.session, data.account);
  return "waiting";
}

export async function signInWithCode(code: string, turnstileToken: string): Promise<Account | "bad_code" | "failed"> {
  const res = await request("/auth/otp", { method: "POST", body: JSON.stringify({ code, turnstile_token: turnstileToken }) }).catch(() => null);
  if (res?.status === 400) return "bad_code";
  if (!res?.ok) return "failed";
  const data = (await res.json()) as { session: string; account: Account };
  return adopt(data.session, data.account);
}

export async function fetchMe(): Promise<{ account: Account; posts: OwnedPost[] } | null> {
  if (!readSession()) return null;
  const res = await request("/me").catch(() => null);
  if (res?.status === 401) {
    setSession(null); // expired or deleted elsewhere
    return null;
  }
  return res?.ok ? ((await res.json()) as { account: Account; posts: OwnedPost[] }) : null;
}

export async function saveAccount(profile: { name: string; note: string; regions: string[] }): Promise<Account | null> {
  const res = await request("/me", { method: "PUT", body: JSON.stringify(profile) }).catch(() => null);
  return res?.ok ? ((await res.json()) as { account: Account }).account : null;
}

export async function signOut(): Promise<void> {
  await request("/auth/logout", { method: "POST", body: "{}" }).catch(() => undefined);
  setSession(null);
}

/** Delete my data: the account and everything tied to it, then sign out. */
export async function deleteAccount(): Promise<boolean> {
  const res = await request("/me", { method: "DELETE" }).catch(() => null);
  if (!res?.ok) return false;
  setSession(null);
  return true;
}
