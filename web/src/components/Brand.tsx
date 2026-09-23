import { motion, useReducedMotion } from "motion/react";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";

/**
 * The logo: hovering rolls the ball across the wordmark and sweeps a lime
 * underline out from the left.
 */
export function Brand({ className, to = "/" }: { className?: string; to?: string }) {
  const reduce = useReducedMotion();

  return (
    <Link to={to} aria-label="Khelbi Naki — home" className={cn("group relative inline-flex items-center gap-1.5", className)}>
      <span className="relative">
        Khelbi{" "}
        <motion.span
          className="inline-block text-primary"
          whileHover={reduce ? undefined : { rotate: -4, y: -2 }}
          transition={{ type: "spring", stiffness: 420, damping: 12 }}
        >
          Naki?
        </motion.span>
        <span className="absolute -bottom-1 left-0 h-[2px] w-0 bg-primary transition-[width] duration-300 ease-out group-hover:w-full motion-reduce:transition-none" />
      </span>
      <motion.span
        aria-hidden="true"
        className="inline-block size-[7px] shrink-0 rounded-full bg-primary opacity-0 group-hover:opacity-100"
        initial={false}
        animate={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      />
    </Link>
  );
}
