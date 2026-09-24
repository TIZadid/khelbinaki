import { dedupeRegions, loadKeeperProfile } from "./keeper";
import { LISTING_TYPES, type ListingType } from "./listing";

// What the Alerts page last chose on this phone: which boards, which places.
export type AlertPrefs = { boards: ListingType[]; regions: string[] };

const STORAGE_KEY = "khelbinaki.alerts.v1";
export const MAX_ALERT_REGIONS = 5;

/** First visit: GK Lagbe, in the keeper profile's places (if any). */
export function defaultAlertPrefs(): AlertPrefs {
  return { boards: ["gk_needed"], regions: loadKeeperProfile()?.regions ?? [] };
}

export function loadAlertPrefs(): AlertPrefs | null {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (typeof parsed !== "object" || parsed === null) return null;
    const p = parsed as Record<string, unknown>;
    const boards = Array.isArray(p.boards) ? LISTING_TYPES.filter((b) => (p.boards as unknown[]).includes(b)) : [];
    const regions = Array.isArray(p.regions) ? dedupeRegions(p.regions.filter((r): r is string => typeof r === "string")) : [];
    return boards.length > 0 ? { boards, regions: regions.slice(0, MAX_ALERT_REGIONS) } : null;
  } catch {
    return null;
  }
}

export function saveAlertPrefs(prefs: AlertPrefs): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage blocked: the choices still apply to alerts turned on right now.
  }
}
