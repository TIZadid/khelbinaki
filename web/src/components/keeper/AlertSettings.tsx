import { Bell, BellOff, Check, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Turnstile } from "@/components/Turnstile";
import {
  ALERTS_CHANGED,
  type AlertState,
  type TelegramKey,
  type TelegramStatus,
  currentSubscription,
  disablePush,
  enablePush,
  loadTelegramKey,
  pushSupported,
  saveTelegramKey,
  telegramLink,
  telegramOff,
  telegramStatus,
} from "@/lib/alerts";
import { regionName } from "@/lib/bd";
import { btn } from "@/lib/ui";
import { cn } from "@/lib/utils";

const BOT_URL = "https://t.me/gklagbebot";

const placesText = (regions: string[]) =>
  regions.length > 0 ? regions.map((slug) => regionName(slug) ?? slug).join(", ") : "anywhere in Bangladesh";

/**
 * Keepers choose how they hear about new GK Lagbe games. There's no login: push
 * is tied to this browser, and Telegram to a link code kept on this phone, which
 * is how the site can show the status, follow place changes and turn it off.
 */
export function AlertSettings({ regions, hasProfile = true }: { regions: string[]; hasProfile?: boolean }) {
  const [push, setPush] = useState<AlertState>("off");
  const [wanted, setWanted] = useState<"push" | "telegram" | null>(null);
  const [busy, setBusy] = useState(false);
  const [telegram, setTelegram] = useState<TelegramKey | null>(() => loadTelegramKey());
  const [tgStatus, setTgStatus] = useState<TelegramStatus["status"] | null>(null);
  const [tgRegions, setTgRegions] = useState<string[] | null>(null);
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

  const refreshTelegram = useCallback(async () => {
    const key = loadTelegramKey();
    setTelegram(key);
    if (!key) {
      setTgStatus(null);
      return;
    }
    try {
      const result = await telegramStatus(key.code);
      setTgStatus(result.status);
      setTgRegions(result.status === "linked" ? (result.regions ? result.regions.split(",") : []) : null);
    } catch {
      // Offline: keep whatever we last knew.
    }
  }, []);

  // Check on load, when the keeper comes back from Telegram, and after places change.
  useEffect(() => {
    refreshTelegram();
    window.addEventListener("focus", refreshTelegram);
    window.addEventListener(ALERTS_CHANGED, refreshTelegram);
    return () => {
      window.removeEventListener("focus", refreshTelegram);
      window.removeEventListener(ALERTS_CHANGED, refreshTelegram);
    };
  }, [refreshTelegram]);

  // While waiting for Start to be tapped, look again every few seconds (for two minutes).
  useEffect(() => {
    if (tgStatus !== "waiting") return;
    let tries = 0;
    const id = window.setInterval(() => {
      if (++tries > 30) window.clearInterval(id);
      else refreshTelegram();
    }, 4000);
    return () => window.clearInterval(id);
  }, [tgStatus, refreshTelegram]);

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
      const key = await telegramLink(regions, token);
      setTelegram(key);
      setTgStatus(key ? "waiting" : null);
      if (!key) setMessage("Telegram alerts aren't set up yet. Try again later.");
    }
    setWanted(null);
    setBusy(false);
  };

  const turnTelegramOff = async () => {
    if (!telegram) return;
    setBusy(true);
    if (await telegramOff(telegram.code)) setTgStatus("stopped");
    else setMessage("Couldn't turn Telegram alerts off. Send /stop to the bot instead.");
    setBusy(false);
  };

  const forgetTelegram = () => {
    saveTelegramKey(null);
    setTelegram(null);
    setTgStatus(null);
  };

  const telegramLine = !telegram
    ? "Get the same alerts as a Telegram message from @gklagbebot."
    : tgStatus === "waiting"
      ? "Open Telegram and tap Start. This updates by itself once you do."
      : tgStatus === "linked"
        ? `On. Watching ${placesText(tgRegions ?? [])}. You can also send /stop to the bot.`
        : tgStatus === "stopped"
          ? "Off. Connect again any time."
          : "Checking…";

  return (
    <section id="alerts" aria-labelledby="alerts-heading" className="mt-10 scroll-mt-24 rounded-3xl border border-[#242a1f] bg-card p-5 md:p-7">
      <h2 id="alerts-heading" className="font-display text-[34px] leading-none font-extrabold uppercase">
        Alert me on GK Lagbe
      </h2>
      <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">
        Get a notification when a game {regions.length > 0 ? "in " : ""}
        <span className="text-foreground">{placesText(regions)}</span> needs a keeper.
        Free, no account, and you can stop any time.
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-subtle">
        {hasProfile
          ? "Change your places above and save: alerts on this phone follow along."
          : "Pick your places above and save your profile to narrow this down. Alerts you turn on now will follow."}
      </p>

      <div className="mt-5 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div>
            <p className="flex items-center gap-2 font-semibold">
              Phone or browser notification
              {push === "on" && <Check aria-label="on" className="size-4 text-primary" />}
            </p>
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
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 font-semibold">
              Telegram
              {tgStatus === "linked" && <Check aria-label="on" className="size-4 text-primary" />}
            </p>
            <p aria-live="polite" className="mt-1 text-sm text-muted-foreground">
              {telegramLine}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {telegram && tgStatus === "waiting" && (
              <a href={telegram.link} target="_blank" rel="noopener noreferrer" className={btn.outline}>
                <Send aria-hidden="true" className="size-4" /> Open Telegram
              </a>
            )}
            {telegram && tgStatus === "linked" && (
              <>
                <a href={BOT_URL} target="_blank" rel="noopener noreferrer" className={btn.outline}>
                  <Send aria-hidden="true" className="size-4" /> Open bot
                </a>
                <button type="button" onClick={turnTelegramOff} disabled={busy} className={cn(btn.outline, "disabled:opacity-60")}>
                  <BellOff aria-hidden="true" className="size-4" /> Turn off
                </button>
              </>
            )}
            {(!telegram || tgStatus === "stopped" || tgStatus === "unknown") && (
              <button
                type="button"
                onClick={() => {
                  if (telegram) forgetTelegram();
                  setWanted("telegram");
                }}
                disabled={busy || wanted === "telegram"}
                className={cn(btn.outline, "disabled:opacity-60")}
              >
                <Send aria-hidden="true" className="size-4" /> {telegram ? "Connect again" : "Connect"}
              </button>
            )}
          </div>
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
