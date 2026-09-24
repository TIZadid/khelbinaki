import { Check, X } from "lucide-react";
import { useState } from "react";
import { AlertChannels } from "@/components/alerts/AlertChannels";
import { RevealWords } from "@/components/motion/RevealWords";
import { RegionSelect } from "@/components/RegionSelect";
import { syncAlerts } from "@/lib/alerts";
import { type AlertPrefs, MAX_ALERT_REGIONS, defaultAlertPrefs, loadAlertPrefs, saveAlertPrefs } from "@/lib/alertPrefs";
import { regionName } from "@/lib/bd";
import { dedupeRegions } from "@/lib/keeper";
import { LISTINGS, LISTING_TYPES, type ListingType } from "@/lib/listing";
import { cn } from "@/lib/utils";

const field =
  "mt-2 w-full rounded-xl border border-line bg-card/80 px-4 py-3 text-base outline-none focus-visible:border-primary";

// "/alerts?board=opp" (from a board's "Get alerts" link) makes sure that board is on.
function initialPrefs(): AlertPrefs {
  const prefs = loadAlertPrefs() ?? defaultAlertPrefs();
  const wanted = new URLSearchParams(window.location.search).get("board");
  const board: ListingType | null = wanted === "opp" ? "opponent_needed" : wanted === "gk" ? "gk_needed" : null;
  if (board && !prefs.boards.includes(board)) {
    return { ...prefs, boards: LISTING_TYPES.filter((b) => b === board || prefs.boards.includes(b)) };
  }
  return prefs;
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="border-t border-border pt-7">
      <h2 className="flex items-baseline gap-3 pb-4">
        <span className="font-display text-lg font-bold text-primary">{n}</span>
        <span className="eyebrow">{title}</span>
      </h2>
      {children}
    </section>
  );
}

export function AlertsPage() {
  const [prefs, setPrefs] = useState<AlertPrefs>(initialPrefs);
  const [regionDraft, setRegionDraft] = useState("");
  const [followed, setFollowed] = useState(false);

  const update = (next: AlertPrefs) => {
    setPrefs(next);
    saveAlertPrefs(next);
    setFollowed(false);
    // Anything already on moves to the new choices.
    syncAlerts(next).then((moved) => setFollowed(moved > 0));
  };

  const toggleBoard = (board: ListingType) => {
    const on = prefs.boards.includes(board);
    if (on && prefs.boards.length === 1) return; // at least one board stays on
    update({ ...prefs, boards: LISTING_TYPES.filter((b) => (b === board ? !on : prefs.boards.includes(b))) });
  };

  const addRegion = (slug: string) => {
    if (!slug) return;
    update({ ...prefs, regions: dedupeRegions([...prefs.regions, slug]).slice(0, MAX_ALERT_REGIONS) });
    setRegionDraft("");
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-5 pt-10 pb-24 md:px-10">
      <p className="eyebrow text-primary">Free · no account · stop any time</p>
      <h1 aria-label="Alerts" className="mt-3.5 font-display text-7xl leading-[0.86] font-extrabold uppercase md:text-8xl">
        <RevealWords text="Alerts" />
      </h1>
      <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground">
        Hear about new posts near you the moment they go up — on this device, on Telegram, or both.
      </p>

      <div className="mt-10 flex flex-col gap-9">
        <Step n="01" title="What for?">
          <div className="grid gap-3 sm:grid-cols-2">
            {LISTING_TYPES.map((board) => {
              const copy = LISTINGS[board];
              const on = prefs.boards.includes(board);
              return (
                <button
                  key={board}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleBoard(board)}
                  className={cn(
                    copy.tone,
                    "flex items-start gap-3.5 rounded-2xl border bg-card/80 p-4.5 text-left transition-colors duration-150",
                    on ? "border-board" : "border-[#242a1f] hover:border-line",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md border",
                      on ? "border-board bg-board text-board-foreground" : "border-line",
                    )}
                  >
                    {on && <Check className="size-3.5" />}
                  </span>
                  <span>
                    <span className={cn("block font-display text-2xl leading-none font-bold uppercase", on && "text-board")}>
                      {copy.board}
                    </span>
                    <span className="mt-1.5 block text-sm text-muted-foreground">{copy.tagline}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {prefs.boards.length === 1 && <p className="mt-2 text-[13px] text-subtle">Keep at least one on.</p>}
        </Step>

        <Step n="02" title="Where?">
          <label htmlFor="alert-region" className="text-sm font-semibold">
            Districts or divisions
          </label>
          <p className="mt-1 text-sm text-muted-foreground">
            Up to {MAX_ALERT_REGIONS}. Leave empty to hear about anywhere in Bangladesh.
          </p>
          <RegionSelect
            id="alert-region"
            value={regionDraft}
            onChange={addRegion}
            includeDivisions
            placeholder="Add a district or division"
            className={field}
          />
          {prefs.regions.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {prefs.regions.map((slug) => (
                <li key={slug}>
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary py-1 pr-1 pl-3 text-sm text-primary">
                    {regionName(slug) ?? slug}
                    <button
                      type="button"
                      onClick={() => update({ ...prefs, regions: prefs.regions.filter((r) => r !== slug) })}
                      aria-label={`Remove ${regionName(slug) ?? slug}`}
                      className="rounded-full p-1 hover:text-foreground"
                    >
                      <X aria-hidden="true" className="size-3.5" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Step>

        <Step n="03" title="How?">
          <AlertChannels prefs={prefs} />
        </Step>

        {followed && (
          <p role="status" className="text-sm font-semibold text-primary">
            Saved. Your alerts now follow these choices.
          </p>
        )}
      </div>
    </div>
  );
}
