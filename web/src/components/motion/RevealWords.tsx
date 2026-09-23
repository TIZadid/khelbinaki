import { motion, useReducedMotion } from "motion/react";

/** Headline words rising into place from behind a mask, one after another. */
export function RevealWords({
  text,
  className,
  wordClassName,
  delay = 0,
}: {
  text: string;
  className?: string;
  wordClassName?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const words = text.split(" ");

  return (
    <span className={className}>
      {words.map((word, i) => (
        // A word can't wrap mid-mask, so each gets its own clipped line box. The
        // trailing space rides inside the word: a lone whitespace span would be
        // dropped from the heading's accessible name ("Needa keeper?").
        <span key={`${word}-${i}`} className="inline-block overflow-hidden align-bottom">
          <motion.span
            className={`inline-block whitespace-pre ${wordClassName ?? ""}`}
            initial={reduce ? false : { y: "105%" }}
            animate={{ y: 0 }}
            transition={{ duration: 0.7, delay: delay + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            {i < words.length - 1 ? `${word} ` : word}
          </motion.span>
        </span>
      ))}
    </span>
  );
}
