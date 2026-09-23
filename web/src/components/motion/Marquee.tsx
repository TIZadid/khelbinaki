import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from "motion/react";
import { Fragment, useRef } from "react";

const wrap = (min: number, max: number, v: number) => {
  const range = max - min;
  return ((((v - min) % range) + range) % range) + min;
};

/**
 * A ticker band that drifts on its own and speeds up (or reverses) with the
 * reader's scroll, so the page feels like it's reacting to them.
 */
export function Marquee({ items, speed = 3 }: { items: string[]; speed?: number }) {
  const reduce = useReducedMotion();
  const offset = useMotionValue(0);
  const { scrollY } = useScroll();
  const velocity = useSpring(useVelocity(scrollY), { damping: 50, stiffness: 400 });
  const boost = useTransform(velocity, [-1000, 0, 1000], [-4, 0, 4], { clamp: false });
  const direction = useRef(1);
  const x = useTransform(offset, (v) => `${wrap(-50, 0, v)}%`);

  useAnimationFrame((_, delta) => {
    if (reduce) return;
    const kick = boost.get();
    if (kick < 0) direction.current = -1;
    else if (kick > 0) direction.current = 1;
    offset.set(offset.get() - direction.current * speed * (delta / 1000) * (1 + Math.abs(kick)));
  });

  // Two copies back to back: when the first has scrolled fully out, wrap() snaps to the start.
  const run = (copy: number) => (
    <div className="flex shrink-0 items-center" aria-hidden={copy === 1 || undefined}>
      {items.map((item, i) => (
        <Fragment key={`${copy}-${item}`}>
          <span className={i % 2 === 0 ? "text-foreground" : "text-outline"} style={{ "--outline": "var(--line-strong)" } as React.CSSProperties}>
            {item}
          </span>
          <span aria-hidden="true" className="mx-6 text-primary md:mx-10">
            ✦
          </span>
        </Fragment>
      ))}
    </div>
  );

  return (
    <div className="overflow-hidden border-y bg-card/40 py-5 md:py-7">
      <motion.div
        style={reduce ? undefined : { x }}
        className="flex w-max font-display text-[44px] leading-none font-extrabold whitespace-nowrap uppercase md:text-[88px]"
      >
        {run(0)}
        {run(1)}
      </motion.div>
    </div>
  );
}
