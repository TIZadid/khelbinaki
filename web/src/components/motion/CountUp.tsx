import { animate, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

/** Counts up to `value` once it appears, so the feed's tally feels alive. */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);

  useEffect(() => {
    if (reduce) {
      setShown(value);
      return;
    }
    const controls = animate(0, value, {
      duration: Math.min(0.9, 0.25 + value * 0.08),
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setShown(Math.round(latest)),
    });
    return () => controls.stop();
  }, [value, reduce]);

  return <span className={className}>{shown}</span>;
}
