import { useMemo, useSyncExternalStore } from "react";
import { type KeeperProfile, parseKeeperProfile, readKeeperRaw, subscribeKeeperProfile } from "@/lib/keeper";

// Snapshot the raw string (stable between renders), parse once per change.
export function useKeeperProfile(): KeeperProfile | null {
  const raw = useSyncExternalStore(subscribeKeeperProfile, readKeeperRaw);
  return useMemo(() => parseKeeperProfile(raw), [raw]);
}
