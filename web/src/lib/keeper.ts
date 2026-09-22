import { normalizeBdPhone } from "./phone";

// A keeper's details, kept only in this browser. Sent to a host only with an "I'm interested" request.
export type KeeperProfile = { name: string; phone: string; areas: string[]; note: string };
export type ProfileErrors = Partial<Record<"name" | "phone" | "areas" | "note", string>>;

export const MAX_AREAS = 5;
const STORAGE_KEY = "khelbinaki.keeper.v1";
const CHANGE_EVENT = "khelbinaki:keeper-profile";

// Trimmed, blank-free, unique ignoring case; the first spelling wins.
export function dedupeAreas(areas: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of areas) {
    const area = raw.trim();
    const key = area.toLowerCase();
    if (area && !seen.has(key)) {
      seen.add(key);
      out.push(area);
    }
  }
  return out;
}

export function validateKeeperProfile(input: {
  name: string;
  phone: string;
  areas: string[];
  note: string;
}): { ok: true; value: KeeperProfile } | { ok: false; errors: ProfileErrors } {
  const errors: ProfileErrors = {};

  const name = input.name.trim();
  if (!name) errors.name = "Tell hosts your name";
  else if (name.length > 60) errors.name = "At most 60 characters";

  const phone = normalizeBdPhone(input.phone);
  if (!phone) errors.phone = "Enter a Bangladeshi mobile number like 01712345678";

  const areas = dedupeAreas(input.areas);
  if (areas.length > MAX_AREAS) errors.areas = `Up to ${MAX_AREAS} areas`;
  else if (areas.some((a) => a.length > 40)) errors.areas = "Area names are at most 40 characters";

  const note = input.note.trim();
  if (note.length > 200) errors.note = "At most 200 characters";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, phone: phone as string, areas, note } };
}

function isProfile(value: unknown): value is KeeperProfile {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.name === "string" &&
    typeof p.phone === "string" &&
    typeof p.note === "string" &&
    Array.isArray(p.areas) &&
    p.areas.every((a) => typeof a === "string")
  );
}

// Storage can be missing or throw (private mode, blocked site data): treat that as "no profile".
export function readKeeperRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function parseKeeperProfile(raw: string | null): KeeperProfile | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isProfile(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function loadKeeperProfile(): KeeperProfile | null {
  return parseKeeperProfile(readKeeperRaw());
}

export function saveKeeperProfile(profile: KeeperProfile): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return true;
}

export function clearKeeperProfile(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing could have been stored.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// Fires for changes in this tab (CHANGE_EVENT) and other tabs ("storage").
export function subscribeKeeperProfile(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
