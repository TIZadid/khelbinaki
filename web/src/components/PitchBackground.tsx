import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";

/**
 * Faint pitch markings behind every page, under a scrim that keeps text readable
 * (nngroup.com/articles/text-over-images). With a mouse, the pitch drifts a few
 * pixels behind the pointer — depth, without moving anything you're reading.
 */
export function PitchBackground() {
  const reduce = useReducedMotion();
  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);
  const springX = useSpring(pointerX, { stiffness: 40, damping: 20 });
  const springY = useSpring(pointerY, { stiffness: 40, damping: 20 });
  const x = useTransform(springX, [0, 1], [14, -14]);
  const y = useTransform(springY, [0, 1], [10, -10]);

  useEffect(() => {
    // Fine pointers only: on a phone this would just fight with scrolling.
    if (reduce || !window.matchMedia("(pointer: fine)").matches) return;
    const onMove = (event: PointerEvent) => {
      pointerX.set(event.clientX / window.innerWidth);
      pointerY.set(event.clientY / window.innerHeight);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduce, pointerX, pointerY]);

  return (
    <div
      data-testid="pitch-bg"
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Scrim: a soft wash over the pitch so text keeps its contrast. */}
      <div className="scrim absolute inset-0" />
      <motion.svg
        style={reduce ? undefined : { x, y }}
        className="pitch-fade absolute -inset-4 -z-10 h-[calc(100%+2rem)] w-[calc(100%+2rem)]"
        viewBox="0 0 700 1100"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <g className="stroke-foreground/[0.06]" strokeWidth="1.5">
          <rect x="40" y="40" width="620" height="1020" />
          <line x1="40" y1="550" x2="660" y2="550" />
          <circle cx="350" cy="550" r="91.5" />
          <rect x="148.5" y="40" width="403" height="165" />
          <rect x="258.5" y="40" width="183" height="55" />
          <path d="M 276.9 205 A 91.5 91.5 0 0 0 423.1 205" />
          <rect x="148.5" y="895" width="403" height="165" />
          <rect x="258.5" y="1005" width="183" height="55" />
          <path d="M 276.9 895 A 91.5 91.5 0 0 1 423.1 895" />
        </g>
        <circle cx="350" cy="550" r="3" className="fill-foreground/[0.1]" />
      </motion.svg>
    </div>
  );
}
