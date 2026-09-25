import { useEffect, useState, useSyncExternalStore } from "react";
import { type Account, type OwnedPost, fetchMe, readSession, subscribeSession } from "@/lib/account";

export type AccountState =
  | { status: "signed_out" }
  | { status: "loading" }
  | { status: "ready"; account: Account; posts: OwnedPost[] };

/** The signed-in Telegram account, if any; re-reads when the session changes. */
export function useAccount(): AccountState & { refresh: () => void } {
  const session = useSyncExternalStore(subscribeSession, readSession);
  const [state, setState] = useState<AccountState>(session ? { status: "loading" } : { status: "signed_out" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!session) {
      setState({ status: "signed_out" });
      return;
    }
    let live = true;
    setState({ status: "loading" });
    fetchMe().then((me) => {
      if (live) setState(me ? { status: "ready", ...me } : { status: "signed_out" });
    });
    return () => {
      live = false;
    };
  }, [session, attempt]);

  return { ...state, refresh: () => setAttempt((n) => n + 1) };
}
