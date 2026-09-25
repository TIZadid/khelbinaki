import { useEffect, useSyncExternalStore } from "react";
import type { ListingType } from "./listing";

// Which main section the visitor is in, so every menu can say "you are here".
export type Section = "home" | "gk" | "opp" | "alerts" | "me" | "help";

export function sectionOfPath(path: string): Section | null {
  if (path === "/") return "home";
  if (path === "/gk-lagbe" || path === "/new" || path === "/new/keeper") return "gk";
  if (path === "/opponent-lagbe" || path === "/new/opponent") return "opp";
  if (path === "/alerts") return "alerts";
  if (path === "/me" || path === "/keeper" || path === "/my-posts") return "me";
  if (path === "/help") return "help";
  return null; // a post or manage page: the page says which board (usePostSection)
}

// A post page only knows its board once the post loads; it reports it here.
let postBoard: ListingType | null = null;
const listeners = new Set<() => void>();
function setPostBoard(board: ListingType | null) {
  postBoard = board;
  for (const listener of listeners) listener();
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useSection(path: string): Section | null {
  const board = useSyncExternalStore(subscribe, () => postBoard);
  const fromPath = sectionOfPath(path);
  if (fromPath) return fromPath;
  return board === "opponent_needed" ? "opp" : board === "gk_needed" ? "gk" : null;
}

/** Post and manage pages call this so the menus highlight the post's board. */
export function usePostSection(board: ListingType | null) {
  useEffect(() => {
    setPostBoard(board);
    return () => setPostBoard(null);
  }, [board]);
}
