import { Bell, BellOff, Check, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Turnstile } from "@/components/Turnstile";
import {
  ALERTS_CHANGED,
  type AlertState,
  type BotKey,
  type TelegramKey,
  type TelegramStatus,
  botOf,
  currentSubscription,
  disablePush,
  enablePush,
  loadTelegramKeys,
  pushSupported,
  saveTelegramKey,
  telegramLink,
  telegramOff,
  telegramStatus,
} from "@/lib/alerts";
import type { AlertPrefs } from "@/lib/alertPrefs";
import { regionName } from "@/lib/bd";
import { LISTINGS, type ListingType } from "@/lib/listing";
import { btn } from "@/lib/ui";
import { cn } from "@/lib/utils";

const BOT_URLS: Record<BotKey, string> = { gk: "https://t.me/gklagbebot", opp: "https://t.me/opponentlagbebot" };
const BOT_NAMES: Record<BotKey, string> = { gk: "@gklagbebot", opp: "@opponentlagbebot" };

const placesText = (regions: string[]) =>
  regions.length > 0 ? regions.map((slug) => regionName(slug) ?? slug).join(", ") : "anywhere in Bangladesh";

type Wanted = "push" | BotKey | null;

/**
 * How alerts reach you: this device (one push alert covering the chosen boards)
 * and Telegram (one bot per board). No login: push is tied to this browser, and
 * each bot to a link code kept on this phone.
 */
export function AlertChannels({ prefs }: { prefs: AlertPrefs }) {
  const [push, setPush] = useState<AlertState>("off");
  const [wanted, setWanted] = useState<Wanted>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [links, setLinks] = useState(0); // bumps when a new Telegram link is made, so rows re-read

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
      const state = await enablePush(prefs.regions, prefs.boards, token);
      setPush(state);
      if (state === "blocked") setMessage("Your browser is blocking notifications for this site.");
      if (state === "off") setMessage("Couldn't switch alerts on. Try again.");
    } else if (wanted) {
      const result = await telegramLink(prefs.regions, wanted, token);
      if (result === "unavailable") setMessage(`${LISTINGS[wanted === "opp" ? "opponent_needed" : "gk_needed"].board} alerts on Telegram aren't set up yet. Try again later.`);
      else if (!result) setMessage("Couldn't reach Telegram. Try again.");
      setLinks((n) => n + 1);
    }
    setWanted(null);
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <div>
          <p className="flex items-center gap-2 font-semibold">
            This device
            {push === "on" && <Check aria-label="on" className="size-4 text-primary" />}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {push === "unsupported"
              ? "This browser can't do notifications."
              : push === "blocked"
                ? "Blocked in your browser settings."
                : push === "on"
                  ? "On. A notification pops up on this phone or computer."
                  : "A notification on this phone or computer. On iPhone, add this site to your Home Screen first."}
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

      {prefs.boards.map((board) => (
        <TelegramRow
          key={`${board}-${links}`}
          board={board}
          busy={busy}
          onConnect={() => setWanted(botOf(board))}
          waitingForCheck={wanted === botOf(board)}
          onError={setMessage}
        />
      ))}

      {wanted && (
        <div className="mt-2">
          <p className="mb-2 text-sm text-muted-foreground">One quick check that you're human…</p>
          <Turnstile onToken={onToken} onError={() => setMessage("The spam check couldn't load. Check your connection.")} />
        </div>
      )}

      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}

/** One board's Telegram bot: connect, wait for Start, then on / off. */
function TelegramRow({
  board,
  busy,
  onConnect,
  waitingForCheck,
  onError,
}: {
  board: ListingType;
  busy: boolean;
  onConnect: () => void;
  waitingForCheck: boolean;
  onError: (message: string) => void;
}) {
  const bot = botOf(board);
  const copy = LISTINGS[board];
  const [key, setKey] = useState<TelegramKey | null>(() => loadTelegramKeys()[bot] ?? null);
  const [status, setStatus] = useState<TelegramStatus["status"] | null>(null);
  const [regions, setRegions] = useState<string[]>([]);
  const [working, setWorking] = useState(false);

  const refresh = useCallback(async () => {
    const current = loadTelegramKeys()[bot] ?? null;
    setKey(current);
    if (!current) {
      setStatus(null);
      return;
    }
    try {
      const result = await telegramStatus(current.code);
      setStatus(result.status);
      if (result.status === "linked") setRegions(result.regions ? result.regions.split(",") : []);
    } catch {
      // Offline: keep whatever we last knew.
    }
  }, [bot]);

  // Check on load, when coming back from Telegram, and whenever choices change.
  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener(ALERTS_CHANGED, refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener(ALERTS_CHANGED, refresh);
    };
  }, [refresh]);

  // While waiting for Start, look again every few seconds (for two minutes).
  useEffect(() => {
    if (status !== "waiting") return;
    let tries = 0;
    const id = window.setInterval(() => {
      if (++tries > 30) window.clearInterval(id);
      else refresh();
    }, 4000);
    return () => window.clearInterval(id);
  }, [status, refresh]);

  const turnOff = async () => {
    if (!key) return;
    setWorking(true);
    if (await telegramOff(key.code)) setStatus("stopped");
    else onError(`Couldn't turn ${copy.board} alerts off. Send /stop to ${BOT_NAMES[bot]} instead.`);
    setWorking(false);
  };

  const line = !key
    ? `Messages from ${BOT_NAMES[bot]}.`
    : status === "waiting"
      ? "Open Telegram and tap Start. This updates by itself once you do."
      : status === "linked"
        ? `On. Watching ${placesText(regions)}. You can also send /stop to the bot.`
        : status === "stopped" || status === "unknown"
          ? "Off. Connect again any time."
          : "Checking…";

  return (
    <div className={cn(copy.tone, "flex flex-wrap items-center justify-between gap-3 border-t pt-4")}>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-semibold">
          <span aria-hidden="true" className="size-[7px] rounded-full bg-board" />
          Telegram · {copy.board}
          {status === "linked" && <Check aria-label="on" className="size-4 text-board" />}
        </p>
        <p aria-live="polite" className="mt-1 text-sm text-muted-foreground">
          {line}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {key && status === "waiting" && (
          <a href={key.link} target="_blank" rel="noopener noreferrer" className={cn(btn.outline, "border-board text-board")}>
            <Send aria-hidden="true" className="size-4" /> Open Telegram
          </a>
        )}
        {key && status === "linked" && (
          <>
            <a href={BOT_URLS[bot]} target="_blank" rel="noopener noreferrer" className={btn.outline}>
              <Send aria-hidden="true" className="size-4" /> Open bot
            </a>
            <button type="button" onClick={turnOff} disabled={working} className={cn(btn.outline, "disabled:opacity-60")}>
              <BellOff aria-hidden="true" className="size-4" /> Turn off
            </button>
          </>
        )}
        {(!key || status === "stopped" || status === "unknown") && (
          <button
            type="button"
            onClick={() => {
              if (key) saveTelegramKey(bot, null);
              onConnect();
            }}
            disabled={busy || waitingForCheck}
            aria-label={`Connect Telegram for ${copy.board}`}
            className={cn(btn.outline, "border-board text-board disabled:opacity-60")}
          >
            <Send aria-hidden="true" className="size-4" /> {key ? "Connect again" : "Connect"}
          </button>
        )}
      </div>
    </div>
  );
}
