import { useEffect, useRef } from "react";

// Cloudflare Turnstile: free spam check. The site key is public.
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "0x4AAAAAAFAQISNULqQDLara";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loader: Promise<TurnstileApi | null> | undefined;

function loadTurnstile(): Promise<TurnstileApi | null> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loader ??= new Promise<TurnstileApi | null>((resolve) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(window.turnstile ?? null);
    script.onerror = () => resolve(null);
    document.head.append(script);
  });
  return loader;
}

/** Renders the widget and hands back a one-use token. */
export function Turnstile({ onToken, onError }: { onToken: (token: string) => void; onError: () => void }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let widgetId: string | undefined;
    let api: TurnstileApi | null = null;
    let cancelled = false;

    loadTurnstile().then((loaded) => {
      api = loaded;
      if (cancelled || !box.current) return;
      if (!api) {
        onError();
        return;
      }
      widgetId = api.render(box.current, {
        sitekey: SITE_KEY,
        theme: "dark",
        callback: onToken,
        "error-callback": onError,
        "expired-callback": onError,
      });
    });

    return () => {
      cancelled = true;
      if (api && widgetId) api.remove(widgetId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- render once per mount
  }, []);

  return <div ref={box} className="min-h-[65px]" />;
}
