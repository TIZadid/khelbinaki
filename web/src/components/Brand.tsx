import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";

/**
 * The mark: a football reduced to its essentials — a lime disc, one pentagon and
 * the five seams leaving it. Same drawing as public/favicon.svg.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="12 12 40 40" aria-hidden="true" className={className}>
      <circle cx="32" cy="32" r="20" fill="var(--primary)" />
      <g stroke="var(--background)" strokeWidth="2.6" strokeLinecap="round">
        <line x1="32" y1="24.5" x2="32" y2="11" />
        <line x1="39.1" y1="29.7" x2="52" y2="25.5" />
        <line x1="36.4" y1="38.1" x2="44.3" y2="49" />
        <line x1="27.6" y1="38.1" x2="19.7" y2="49" />
        <line x1="24.9" y1="29.7" x2="12" y2="25.5" />
      </g>
      <polygon
        points="32,24.5 39.1,29.7 36.4,38.1 27.6,38.1 24.9,29.7"
        fill="var(--background)"
        stroke="var(--background)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The logo: mark + wordmark. Hovering rolls the ball a fifth of a turn (a
 * pentagon lands back on itself) and sweeps a lime underline out from the left.
 */
export function Brand({ className, to = "/" }: { className?: string; to?: string }) {
  return (
    <Link to={to} aria-label="Khelbi Naki — home" className={cn("group relative inline-flex items-center gap-2.5", className)}>
      <BrandMark className="size-[1.05em] shrink-0 transition-transform duration-500 ease-out group-hover:rotate-[72deg] motion-reduce:transition-none" />
      <span className="relative">
        Khelbi <span className="text-primary">Naki?</span>
        <span className="absolute -bottom-1 left-0 h-[2px] w-0 bg-primary transition-[width] duration-300 ease-out group-hover:w-full motion-reduce:transition-none" />
      </span>
    </Link>
  );
}
