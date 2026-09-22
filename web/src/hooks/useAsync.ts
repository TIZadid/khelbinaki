import { type DependencyList, useEffect, useState } from "react";

export type AsyncState<T> = { status: "loading" } | { status: "error" } | { status: "ready"; data: T };

// Runs `load` on mount and whenever `deps` change; aborts stale requests. Remount (key) to reset.
export function useAsync<T>(load: (signal: AbortSignal) => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ status: "ready", data });
      },
      () => {
        if (!controller.signal.aborted) setState({ status: "error" });
      },
    );
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callers pass the load inputs as deps
  }, [...deps, attempt]);

  const retry = () => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  };

  return { state, retry };
}
