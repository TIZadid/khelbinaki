import { Plus } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from "motion/react";
import { useState } from "react";
import { LISTINGS, type ListingType } from "@/lib/listing";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";

/**
 * Phones: the board's post button within thumb reach above the tab bar, once the
 * board's own post button has scrolled away. It shows its words when scrolling
 * up, and tucks into a round "+" while reading down so it covers little.
 */
export function PostFab({ type }: { type: ListingType }) {
  const copy = LISTINGS[type];
  const { scrollY } = useScroll();
  const [compact, setCompact] = useState(false);
  const [shown, setShown] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => {
    const previous = scrollY.getPrevious() ?? 0;
    setShown(y > 320);
    setCompact(y > previous);
  });

  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 380, damping: 26 }}
          className={cn(
            copy.tone,
            "fixed right-4 bottom-[calc(var(--tabbar-h)+1rem)] z-30 md:hidden",
          )}
        >
          <Link
            to={copy.newPath}
            aria-label={copy.postCta}
            className="flex h-14 items-center overflow-hidden rounded-full bg-board text-board-foreground shadow-[0_14px_40px_-12px_color-mix(in_srgb,var(--board)_70%,transparent)] transition-transform active:scale-95"
          >
            <span className="flex size-14 shrink-0 items-center justify-center">
              <Plus aria-hidden="true" className="size-6" strokeWidth={2.6} />
            </span>
            <motion.span
              aria-hidden="true"
              initial={false}
              animate={{
                width: compact ? 0 : "auto",
                opacity: compact ? 0 : 1,
              }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className="block pr-0 text-[15px] font-semibold whitespace-nowrap"
            >
              <span className="block pr-5">{copy.postCta}</span>
            </motion.span>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
