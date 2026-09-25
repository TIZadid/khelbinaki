import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

/**
 * Headline words rising into place from behind a mask, one after another.
 * `inView` waits until the words scroll onto the screen instead of playing on load.
 *
 * The mask (overflow: hidden) only exists while the words rise: once they land it
 * lifts, so glows, text shadows and descenders are never cropped by its box.
 */
export function RevealWords({
  text,
  className,
  wordClassName,
  delay = 0,
  inView = false,
}: {
  text: string;
  className?: string;
  wordClassName?: string;
  delay?: number;
  inView?: boolean;
}) {
  const reduce = useReducedMotion();
  const words = text.split(" ");
  const [landed, setLanded] = useState(Boolean(reduce));

  return (
    <span className={className}>
      {/* Screen readers get the plain sentence; the animated words are decoration. */}
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, i) => {
          const transition = { duration: 0.8, delay: delay + i * 0.07, ease: [0.22, 1, 0.36, 1] as const };
          const last = i === words.length - 1;
          return (
            // A word can't wrap mid-mask, so each gets its own line box, with its
            // trailing space riding inside it.
            <span
              key={`${word}-${i}`}
              className={`-mb-[0.08em] inline-block pb-[0.08em] align-bottom ${landed ? "overflow-visible" : "overflow-hidden"}`}
            >
              <motion.span
                className={`inline-block whitespace-pre ${wordClassName ?? ""}`}
                initial={reduce ? false : { y: "110%", rotate: 4 }}
                {...(inView
                  ? { whileInView: { y: 0, rotate: 0 }, viewport: { once: true, margin: "-10% 0px" } }
                  : { animate: { y: 0, rotate: 0 } })}
                transition={transition}
                onAnimationComplete={last ? () => setLanded(true) : undefined}
              >
                {i < words.length - 1 ? `${word} ` : word}
              </motion.span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
