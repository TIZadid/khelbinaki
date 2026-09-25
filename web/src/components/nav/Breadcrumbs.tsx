import { ChevronRight, Home } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; to?: string };

/**
 * "Home › GK Lagbe › Mirpur": where you are, and one tap back to anywhere above
 * it. The last crumb is the current page.
 */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  const all: Crumb[] = [{ label: "Home", to: "/" }, ...items];
  return (
    <motion.nav
      aria-label="Breadcrumb"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn("text-sm", className)}
    >
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-muted-foreground">
        {all.map((crumb, i) => {
          const last = i === all.length - 1;
          return (
            <li key={`${crumb.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight aria-hidden="true" className="size-3.5 text-subtle" />}
              {last || !crumb.to ? (
                <span aria-current={last ? "page" : undefined} className="max-w-[16rem] truncate font-semibold text-foreground">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.to}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-md underline decoration-line underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground"
                >
                  {i === 0 && <Home aria-hidden="true" className="size-3.5" />}
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </motion.nav>
  );
}
