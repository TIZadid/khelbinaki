import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export type AreaOption = { key: string; label: string; count: number };

// One chip per area (case-insensitive), most posts first.
export function areaOptions(areas: string[]): AreaOption[] {
  const byKey = new Map<string, AreaOption>();
  for (const area of areas) {
    const key = area.trim().toLowerCase();
    const existing = byKey.get(key);
    if (existing) existing.count += 1;
    else byKey.set(key, { key, label: area.trim(), count: 1 });
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function AreaChips({
  options,
  selected,
  onSelect,
}: {
  options: AreaOption[];
  selected: string | null;
  onSelect: (key: string | null) => void;
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
          "relative isolate rounded-full border px-4 py-1.5 text-sm transition-colors",
          active ? "border-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        {active && (
          <motion.span
            layoutId="area-chip"
            className="absolute inset-0 -z-10 rounded-full bg-primary"
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
          />
        )}
        {label}
        {count !== undefined && <sup className="ml-0.5">{count}</sup>}
      </button>
    );
  };

  return (
    <div role="group" aria-label="Filter by area" className="flex flex-wrap gap-2">
      {chip(null, "All")}
      {options.map((o) => chip(o.key, o.label, o.count))}
    </div>
  );
}
