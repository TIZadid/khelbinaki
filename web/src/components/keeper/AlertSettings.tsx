import { Bell, BellOff, Send } from "lucide-react";
import { regionName } from "@/lib/bd";
import { useEffect, useState } from "react";
import { Turnstile } from "@/components/Turnstile";
import { type AlertState, currentSubscription, disablePush, enablePush, pushSupported, telegramLink } from "@/lib/alerts";
import { btn } from "@/lib/ui";
import { cn } from "@/lib/utils";

/**
 * Keepers choose how they hear about new games. Both channels are free; both
 * need the one-off spam check, so the widget only loads once they ask for it.
 */
export function AlertSettings({ regions }: { regions: string[] }) {
  const [push, setPush] = useState<AlertState>("off");
  const [wanted, setWanted] = useState<"push" | "telegram" | null>(null);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!pushSupported()) {
      setPush("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setPush("blocked");
      return;
    }
    currentSubscription().then((subscription) => setPush(subscription ? "on" : "off"));
  }, []);

  const onToken = async (token: string) => {
    setBusy(true);
    setMessage("");
    if (wanted === "push") {
      const state = await enablePush(regions, token);
      setPush(state);
      if (state === "blocked") setMessage("Your browser is blocking notifications for this site.");
      if (state === "off") setMessage("Couldn't switch alerts on. Try again.");
    }
    if (wanted === "telegram") {
      const result = await telegramLink(regions, token);
      setLink(result);
      if (!result) setMessage("Telegram alerts aren't set up yet. Try again later.");
    }
    setWanted(null);
    setBusy(false);
  };

  const placeLabel =
    regions.length > 0 ? regions.map((slug) => regionName(slug) ?? slug).join(", ") : "anywhere in Bangladesh";

  return (
    <section aria-labelledby="alerts-heading" className="mt-10 rounded-3xl border border-[#242a1f] bg-card p-5 md:p-7">
      <h2 id="alerts-heading" className="font-display text-[34px] leading-none font-extrabold uppercase">
        Alert me on GK Lagbe
      </h2>
      <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">
        Get a notification when a game in <span className="text-foreground">{placeLabel}</span> needs a keeper. Free, and
        you can stop any time.
      </p>

      <div className="mt-5 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div>
            <p className="font-semibold">Phone or browser notification</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {push === "unsupported"
                ? "This browser can't do notifications."
                : push === "blocked"
                  ? "Blocked in your browser settings."
                  : push === "on"
                    ? "On for this device."
                    : "On iPhone, add this site to your Home Screen first."}
            </p>
          </div>
          {push === "on" ? (
            <button
              type="button"
              onClick={async () => {
                setBusy(true);
                await disablePush();
                setPush("off");
                setBusy(false);
              }}
              disabled={busy}
              className={cn(btn.outline, "disabled:opacity-60")}
            >
              <BellOff aria-hidden="true" className="size-4" /> Turn off
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setWanted("push")}
              disabled={busy || push === "unsupported" || push === "blocked" || wanted === "push"}
              className={cn(btn.outline, "disabled:opacity-60")}
            >
              <Bell aria-hidden="true" className="size-4" /> Turn on
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div>
            <p className="font-semibold">Telegram</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {link ? "Open the link, then tap Start in Telegram." : "Get the same alerts as a Telegram message."}
            </p>
          </div>
          {link ? (
            <a href={link} target="_blank" rel="noopener noreferrer" className={btn.outline}>
              <Send aria-hidden="true" className="size-4" /> Open Telegram
            </a>
          ) : (
            <button
              type="button"
              onClick={() => setWanted("telegram")}
              disabled={busy || wanted === "telegram"}
              className={cn(btn.outline, "disabled:opacity-60")}
            >
              <Send aria-hidden="true" className="size-4" /> Connect
            </button>
          )}
        </div>
      </div>

      {wanted && (
        <div className="mt-5">
          <p className="mb-2 text-sm text-muted-foreground">One quick check that you're human…</p>
          <Turnstile onToken={onToken} onError={() => setMessage("The spam check couldn't load. Check your connection.")} />
        </div>
      )}

      {message && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {message}
        </p>
      )}
    </section>
  );
}
