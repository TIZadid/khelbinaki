import { useEffect, useState } from "react";
import { fetchFeed, type PublicPost } from "@/lib/api";

export type FeedState = { status: "loading" } | { status: "error" } | { status: "ready"; posts: PublicPost[] };

export function useFeed() {
  const [state, setState] = useState<FeedState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchFeed(controller.signal).then(
      (posts) => setState({ status: "ready", posts }),
      () => {
        if (!controller.signal.aborted) setState({ status: "error" });
      },
    );
    return () => controller.abort();
  }, [attempt]);

  const retry = () => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  };

  return { state, retry };
}
