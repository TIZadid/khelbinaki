import { motion } from "motion/react";
import { districtName } from "@/lib/bd";
import { cn } from "@/lib/utils";

export type AreaOption = { key: string; label: string; count: number };

// Sentinel for the chip that filters to the keeper profile's areas.
export const MY_AREAS_KEY = "__mine";

// One chip per district, most games first.
export function areaOptions(districts: string[]): AreaOption[] {
  const byKey = new Map<string, AreaOption>();
  for (const district of districts) {
    const key = district.trim().toLowerCase();
    if (!key) continue;
    const existing = byKey.get(key);
    if (existing) existing.count += 1;
    else byKey.set(key, { key, label: districtName(key) ?? key, count: 1 });
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function AreaChips({
  options,
  selected,
  onSelect,
  showMine = false,
  layoutId = "area-chip",
}: {
  options: AreaOption[];
  selected: string | null;
  onSelect: (key: string | null) => void;
  showMine?: boolean;
  /** Unique per board, or the highlight would fly between the two boards. */
  layoutId?: string;
}) {
  const chip = (key: string | null, label: string, count?: number) => {
    const active = selected === key;
    return (
      <button
        key={key ?? "all"}
        type="button"
        aria-pressed={active}
        onClick={() => onSelect(key)}
        className={cn(
          "relative isolate h-11 shrink-0 rounded-full border px-[18px] text-[15px] font-medium transition-colors",
          active ? "border-transparent text-background" : "border-[#242a1f] text-muted-foreground hover:border-line hover:text-foreground",
        )}
      >
        {active && (
          <motion.span
            layoutId={layoutId}
            className="absolute inset-0 -z-10 rounded-full bg-foreground"
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
          />
        )}
        {label}
        {count !== undefined && <sup className="ml-0.5 text-[10px]">{count}</sup>}
      </button>
    );
  };

  return (
    <div role="group" aria-label="Filter by district" className="flex flex-wrap gap-2">
      {chip(null, "All of Bangladesh")}
      {showMine && chip(MY_AREAS_KEY, "My places")}
      {options.map((o) => chip(o.key, o.label, o.count))}
    </div>
  );
}
