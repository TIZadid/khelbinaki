import { useEffect } from "react";

/** Names the browser tab after the page, so people always know where they are. */
export function usePageTitle(title: string | null) {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = `${title} — Khelbi Naki`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
