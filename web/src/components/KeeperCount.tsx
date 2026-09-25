import { CountUp } from "@/components/motion/CountUp";
import { useAsync } from "@/hooks/useAsync";
import { fetchStats } from "@/lib/api";
import { LISTINGS } from "@/lib/listing";
import { cn } from "@/lib/utils";

// Below this a count reads as "empty", so nothing is shown until the board has some life.
export const MIN_KEEPERS_SHOWN = 20;

/** "● 128 keepers on alert" — a live, pulsing count of keepers who hear about new GK Lagbe games. */
export function KeeperCount({ className }: { className?: string }) {
  const { state } = useAsync(fetchStats, []);
  if (state.status !== "ready" || state.data.keepers < MIN_KEEPERS_SHOWN) return null;

  return (
    <p className={cn(LISTINGS.gk_needed.tone, "inline-flex items-center gap-2.5 text-sm font-semibold", className)}>
      <span aria-hidden="true" className="relative flex size-2">
        <span className="absolute inline-flex size-full rounded-full bg-board opacity-75 motion-safe:animate-ping" />
        <span className="relative inline-flex size-2 rounded-full bg-board" />
      </span>
      <span>
        <CountUp value={state.data.keepers} className="text-board" /> keepers on alert
      </span>
    </p>
  );
}
