import { ArrowUpRight, Menu, X } from "lucide-react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "motion/react";
import { type ReactNode, useEffect, useState } from "react";
import { Brand } from "@/components/Brand";
import { Magnetic } from "@/components/motion/Magnetic";
import { ScrollProgress } from "@/components/motion/ScrollProgress";
import { useKeeperProfile } from "@/hooks/useKeeperProfile";
import { LISTINGS } from "@/lib/listing";
import { Link, usePath } from "@/lib/router";
import { lockScroll, startSmoothScroll } from "@/lib/smoothScroll";
import { cn } from "@/lib/utils";
import { PitchBackground } from "./PitchBackground";

const EASE = [0.22, 1, 0.36, 1] as const;

const boards = [LISTINGS.gk_needed, LISTINGS.opponent_needed];

export function AppShell({ children }: { children: ReactNode }) {
  const keeper = useKeeperProfile();
  const path = usePath();
  const reduce = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [firstPath] = useState(path);
  const [seenPath, setSeenPath] = useState(path);
  const { scrollY } = useScroll();

  useEffect(() => startSmoothScroll(), []);
  useEffect(() => {
    lockScroll(menuOpen);
    return () => lockScroll(false);
  }, [menuOpen]);
  // A new page always starts with the menu shut and the header showing.
  if (seenPath !== path) {
    setSeenPath(path);
    setMenuOpen(false);
    setHidden(false);
  }

  // Tuck the header away while reading down; bring it back on the first scroll up.
  useMotionValueEvent(scrollY, "change", (y) => {
    const previous = scrollY.getPrevious() ?? 0;
    setScrolled(y > 12);
    setHidden(y > 160 && y > previous && !menuOpen);
  });

  const profileLabel = keeper ? "My profile" : "I'm a keeper";

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-dvh flex-col">
        <PitchBackground />
        <div aria-hidden="true" className="grain" />
        <ScrollProgress />

        <motion.header
          animate={{ y: hidden ? "-100%" : "0%" }}
          transition={{ duration: 0.35, ease: EASE }}
          className={cn(
            "fixed inset-x-0 top-0 z-40 border-b transition-[background-color,border-color,backdrop-filter] duration-300",
            scrolled || menuOpen ? "border-border bg-background/75 backdrop-blur-xl" : "border-transparent",
          )}
        >
          <div className="page-x flex h-17 items-center justify-between gap-6 md:h-20">
            <Brand className="font-display text-2xl font-extrabold tracking-[0.02em] uppercase md:text-[28px]" />

            <nav aria-label="Main" className="hidden items-center gap-8 text-[15px] font-medium text-muted-foreground lg:flex">
              {boards.map((board) => (
                <Link key={board.anchor} to={`/#${board.anchor}`} className="link-draw pb-0.5 hover:text-foreground">
                  {board.board}
                </Link>
              ))}
              <Link to="/#how" className="link-draw pb-0.5 hover:text-foreground">
                How it works
              </Link>
              <Link to="/keeper" className="link-draw pb-0.5 hover:text-foreground">
                {profileLabel}
              </Link>
            </nav>

            <div className="flex items-center gap-2.5">
              <div className="hidden items-center gap-2.5 md:flex">
                <Magnetic>
                  <Link
                    to={LISTINGS.gk_needed.newPath}
                    className="inline-flex h-11 items-center rounded-full border border-primary px-5 text-sm font-semibold text-primary transition-[color,background-color] duration-150 hover:bg-primary hover:text-primary-foreground"
                  >
                    {LISTINGS.gk_needed.postCta}
                  </Link>
                </Magnetic>
                <Magnetic>
                  <Link
                    to={LISTINGS.opponent_needed.newPath}
                    className="inline-flex h-11 items-center rounded-full border border-line px-5 text-sm font-semibold transition-[color,border-color] duration-150 hover:border-foreground"
                  >
                    {LISTINGS.opponent_needed.postCta}
                  </Link>
                </Magnetic>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-controls="site-menu"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                className="inline-flex size-11 items-center justify-center rounded-full border border-line transition-colors hover:border-primary hover:text-primary lg:hidden"
              >
                {menuOpen ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
              </button>
            </div>
          </div>
        </motion.header>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              id="site-menu"
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              data-lenis-prevent
              initial={{ clipPath: "circle(0% at calc(100% - 42px) 34px)" }}
              animate={{ clipPath: "circle(150% at calc(100% - 42px) 34px)" }}
              exit={{ clipPath: "circle(0% at calc(100% - 42px) 34px)" }}
              transition={{ duration: 0.55, ease: EASE }}
              className="fixed inset-0 z-30 overflow-y-auto bg-background pt-17 lg:hidden"
            >
              <nav aria-label="Menu" className="page-x flex min-h-full flex-col justify-between gap-10 pt-8 pb-10">
                <ul className="flex flex-col">
                  {[
                    ...boards.map((b) => ({ to: `/#${b.anchor}`, label: b.board, hint: b.tagline })),
                    { to: "/#how", label: "How it works", hint: "Three steps, no sign-up" },
                    { to: "/keeper", label: profileLabel, hint: "Save your details and get alerts" },
                  ].map((item, i) => (
                    <motion.li
                      key={item.to}
                      initial={{ y: 40, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.12 + i * 0.06, ease: EASE }}
                      className="border-b"
                    >
                      <Link to={item.to} onClick={() => setMenuOpen(false)} className="group flex items-end justify-between gap-4 py-4">
                        <span>
                          <span className="block font-display text-5xl leading-none font-extrabold uppercase transition-colors group-hover:text-primary">
                            {item.label}
                          </span>
                          <span className="mt-1.5 block text-sm text-subtle">{item.hint}</span>
                        </span>
                        <ArrowUpRight aria-hidden="true" className="size-6 shrink-0 text-subtle transition-transform group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-primary" />
                      </Link>
                    </motion.li>
                  ))}
                </ul>
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.4, ease: EASE }}
                  className="flex flex-col gap-2.5"
                >
                  <Link
                    to={LISTINGS.gk_needed.newPath}
                    onClick={() => setMenuOpen(false)}
                    className="inline-flex h-14 items-center justify-center rounded-full bg-primary text-[17px] font-semibold text-primary-foreground"
                  >
                    {LISTINGS.gk_needed.postCta}
                  </Link>
                  <Link
                    to={LISTINGS.opponent_needed.newPath}
                    onClick={() => setMenuOpen(false)}
                    className="inline-flex h-14 items-center justify-center rounded-full border border-line text-[17px] font-semibold"
                  >
                    {LISTINGS.opponent_needed.postCta}
                  </Link>
                </motion.div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.main
          key={path}
          className="flex-1 pt-17 md:pt-20"
          // Slide only: fading the whole page would empty it from the accessibility
          // tree (and hide everything if the animation ever stalled).
          initial={{ y: 18 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          {children}
        </motion.main>

        {/* Page wipe: a panel lifts off the new page. Skipped on first load and for reduced motion. */}
        {!reduce && path !== firstPath && (
          <motion.div
            key={`wipe-${path}`}
            aria-hidden="true"
            initial={{ y: "0%" }}
            animate={{ y: "-100%" }}
            transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
            className="pointer-events-none fixed inset-0 z-50 border-b-2 border-primary bg-card"
          />
        )}

        <Footer />
      </div>
    </MotionConfig>
  );
}

function Footer() {
  const reduce = useReducedMotion();

  const columns: { heading: string; links: { to: string; label: string; external?: boolean }[] }[] = [
    {
      heading: "Boards",
      links: boards.map((b) => ({ to: `/#${b.anchor}`, label: b.board })),
    },
    {
      heading: "Post",
      links: boards.map((b) => ({ to: b.newPath, label: b.postCta })),
    },
    {
      heading: "More",
      links: [
        { to: "/keeper", label: "Keeper profile & alerts" },
        { to: "/cha", label: "Buy me a cha" },
        { to: "https://github.com/TIZadid/khelbinaki/issues", label: "Suggest a feature", external: true },
      ],
    },
  ];

  return (
    <footer className="overflow-hidden border-t">
      <div className="page-x grid gap-10 pt-14 pb-8 md:grid-cols-[1.4fr_repeat(3,1fr)] md:pt-20">
        <div>
          <Brand className="font-display text-[28px] font-extrabold uppercase" />
          <p className="mt-3 max-w-72 text-[15px] leading-relaxed text-subtle">
            The free board for underground futsal across Bangladesh. No sign-up, no fees, no ads.
          </p>
        </div>
        {columns.map((column) => (
          <div key={column.heading}>
            <h2 className="eyebrow text-subtle">{column.heading}</h2>
            <ul className="mt-4 flex flex-col gap-2.5 text-[15px]">
              {column.links.map((link) => (
                <li key={link.label}>
                  {link.external ? (
                    <a href={link.to} target="_blank" rel="noopener noreferrer" className="link-draw text-muted-foreground hover:text-foreground">
                      {link.label}
                    </a>
                  ) : (
                    <Link to={link.to} className="link-draw text-muted-foreground hover:text-foreground">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div aria-hidden="true" className="relative page-x select-none">
        <p
          className="text-outline font-display text-[15.5vw] leading-[0.8] font-extrabold whitespace-nowrap uppercase xl:text-[11.5rem]"
          style={{ "--outline": "var(--line)" } as React.CSSProperties}
        >
          Khelbi Naki?
        </p>
        {/* The giant wordmark fills with lime, left to right, each time it comes into view. */}
        <motion.p
          initial={reduce ? false : { clipPath: "inset(0 100% 0 0)" }}
          whileInView={{ clipPath: "inset(0 0% 0 0)" }}
          viewport={{ amount: 0.8 }}
          transition={{ duration: 1.4, ease: [0.76, 0, 0.24, 1] }}
          className="absolute inset-y-0 left-5 md:left-10 font-display text-[15.5vw] leading-[0.8] font-extrabold whitespace-nowrap text-primary uppercase xl:text-[11.5rem]"
        >
          Khelbi Naki?
        </motion.p>
      </div>

      <div className="page-x flex flex-col gap-1 border-t py-6 text-[13px] text-subtle sm:flex-row sm:justify-between">
        <span>Free forever. Made for futsal across Bangladesh.</span>
        <span>Contact happens on WhatsApp. Numbers are never listed on the board.</span>
      </div>
    </footer>
  );
}
