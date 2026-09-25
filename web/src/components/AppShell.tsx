import { ArrowUp, ArrowUpRight, Bell, Hand, HelpCircle, House, Menu, Swords, UserRound, X } from "lucide-react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useInView,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Brand } from "@/components/Brand";
import { Magnetic } from "@/components/motion/Magnetic";
import { ScrollProgress } from "@/components/motion/ScrollProgress";
import { Toaster } from "@/components/nav/Toaster";
import { LISTINGS } from "@/lib/listing";
import { type Section, useSection } from "@/lib/nav";
import { Link, usePath } from "@/lib/router";
import { lockScroll, scrollToTarget, startSmoothScroll } from "@/lib/smoothScroll";
import { cn } from "@/lib/utils";
import { PitchBackground } from "./PitchBackground";

const EASE = [0.22, 1, 0.36, 1] as const;

const boards = [LISTINGS.gk_needed, LISTINGS.opponent_needed];

// The main places, in the order people reach for them. Each has a colour scope so
// "you are here" shows in that section's colour.
const PLACES: { section: Section; to: string; label: string; short: string; icon: typeof House; tone: string }[] = [
  { section: "home", to: "/", label: "Home", short: "Home", icon: House, tone: "board-site" },
  { section: "gk", to: LISTINGS.gk_needed.path, label: LISTINGS.gk_needed.board, short: LISTINGS.gk_needed.short, icon: Hand, tone: LISTINGS.gk_needed.tone },
  {
    section: "opp",
    to: LISTINGS.opponent_needed.path,
    label: LISTINGS.opponent_needed.board,
    short: LISTINGS.opponent_needed.short,
    icon: Swords,
    tone: LISTINGS.opponent_needed.tone,
  },
  { section: "alerts", to: "/alerts", label: "Alerts", short: "Alerts", icon: Bell, tone: "board-site" },
  { section: "me", to: "/me", label: "Me", short: "Me", icon: UserRound, tone: "board-site" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePath();
  const section = useSection(path);
  const reduce = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [farDown, setFarDown] = useState(false);
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
    setFarDown(y > 1400);
  });

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-dvh flex-col">
        {/* Keyboard and screen-reader users can jump straight past the menus. */}
        <a
          href="#main"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById("main")?.focus();
          }}
          className="fixed top-3 left-3 z-[80] -translate-y-24 rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground transition-transform focus-visible:translate-y-0"
        >
          Skip to content
        </a>
        <PitchBackground />
        <div aria-hidden="true" className="grain" />
        <ScrollProgress />

        <motion.header
          animate={{ y: hidden ? "-100%" : "0%" }}
          transition={{ duration: 0.35, ease: EASE }}
          className={cn(
            "fixed inset-x-0 top-0 z-40 border-b transition-[background-color,border-color,backdrop-filter] duration-300",
            scrolled || menuOpen ? "border-border bg-background/80 backdrop-blur-xl" : "border-transparent",
          )}
        >
          <div className="page-x flex h-17 items-center justify-between gap-6 md:h-20">
            <Brand className="font-display text-2xl font-extrabold tracking-[0.02em] uppercase md:text-[28px]" />

            <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
              {[...PLACES.slice(1), { section: "help" as Section, to: "/help", label: "Help", short: "Help", icon: HelpCircle, tone: "board-site" }].map(
                (place) => {
                  const active = section === place.section;
                  return (
                    <Link
                      key={place.to}
                      to={place.to}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        place.tone,
                        "relative rounded-full px-3.5 py-2 text-[15px] font-medium transition-colors duration-150",
                        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="nav-here"
                          className="absolute inset-x-3.5 -bottom-0.5 h-[3px] rounded-full bg-board"
                          transition={{ type: "spring", stiffness: 480, damping: 36 }}
                        />
                      )}
                      {place.label}
                    </Link>
                  );
                },
              )}
            </nav>

            <div className="flex items-center gap-2.5">
              <div className="hidden items-center gap-2.5 md:flex">
                <Magnetic>
                  <Link
                    to={LISTINGS.gk_needed.newPath}
                    className="board-gk inline-flex h-11 items-center rounded-full border border-board px-5 text-sm font-semibold text-board transition-[color,background-color] duration-150 hover:bg-board hover:text-board-foreground"
                  >
                    {LISTINGS.gk_needed.postCta}
                  </Link>
                </Magnetic>
                <Magnetic>
                  <Link
                    to={LISTINGS.opponent_needed.newPath}
                    className="board-opp inline-flex h-11 items-center rounded-full border border-board px-5 text-sm font-semibold text-board transition-[color,background-color] duration-150 hover:bg-board hover:text-board-foreground"
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
          {menuOpen && <MobileMenu section={section} onClose={() => setMenuOpen(false)} />}
        </AnimatePresence>

        <motion.main
          key={path}
          id="main"
          tabIndex={-1}
          className="flex-1 pt-17 outline-none md:pt-20"
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
            className="pointer-events-none fixed inset-0 z-50 border-b-2 border-board bg-card"
          />
        )}

        <Footer />
        {/* Room for the phone tab bar, so it never covers the end of the page. */}
        <div aria-hidden="true" className="h-[var(--tabbar-h)] md:hidden" />

        <TabBar section={section} />
        <AnimatePresence>
          {farDown && (
            <motion.button
              type="button"
              aria-label="Back to top"
              onClick={() => scrollToTarget(0)}
              initial={{ opacity: 0, scale: 0.6, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.6, y: 20 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: "spring", stiffness: 420, damping: 26 }}
              className="fixed right-4 bottom-[calc(var(--tabbar-h)+1rem)] z-30 inline-flex size-12 items-center justify-center rounded-full border border-line bg-card/90 text-foreground shadow-lg backdrop-blur hover:border-primary hover:text-primary md:right-8 md:bottom-8"
            >
              <ArrowUp aria-hidden="true" className="size-5" />
            </motion.button>
          )}
        </AnimatePresence>
        <Toaster />
      </div>
    </MotionConfig>
  );
}

/**
 * Phones: the five main places, always at the bottom within thumb reach, each an
 * icon *and* a word. The current one is lit in its colour; the light slides over.
 */
function TabBar({ section }: { section: Section | null }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="mx-auto grid h-17 max-w-lg grid-cols-5">
        {PLACES.map((place) => {
          const active = section === place.section;
          const Icon = place.icon;
          return (
            <li key={place.to} className={place.tone}>
              <Link
                to={place.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors duration-150",
                  active ? "text-board" : "text-muted-foreground active:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="tab-here"
                    className="absolute top-0 h-[3px] w-10 rounded-b-full bg-board"
                    transition={{ type: "spring", stiffness: 480, damping: 36 }}
                  />
                )}
                <motion.span
                  className={cn("relative flex h-8 w-14 items-center justify-center rounded-full", active && "bg-board/15")}
                  animate={active ? { scale: 1 } : { scale: 0.94 }}
                  whileTap={{ scale: 0.86 }}
                  transition={{ type: "spring", stiffness: 500, damping: 28 }}
                >
                  <Icon aria-hidden="true" className="size-[22px]" strokeWidth={active ? 2.4 : 1.9} />
                </motion.span>
                {place.short}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function MobileMenu({ section, onClose }: { section: Section | null; onClose: () => void }) {
  const items: { to: string; label: string; hint: string; section?: Section; tone?: string }[] = [
    { to: "/", label: "Home", hint: "Start here", section: "home" },
    ...boards.map((b) => ({ to: b.path, label: b.board, hint: b.tagline, section: (b.tone === "board-gk" ? "gk" : "opp") as Section, tone: b.tone })),
    { to: "/alerts", label: "Alerts", hint: "Hear about new posts near you", section: "alerts" },
    { to: "/me", label: "Me", hint: "Your profile, posts and sign-in", section: "me" },
    { to: "/help", label: "Help", hint: "Answers in plain words", section: "help" },
  ];
  return (
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
      <nav aria-label="Menu" className="page-x flex min-h-full flex-col justify-between gap-10 pt-6 pb-[calc(var(--tabbar-h)+2rem)]">
        <ul className="flex flex-col">
          {items.map((item, i) => {
            const active = item.section === section;
            return (
              <motion.li
                key={item.to}
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.05, ease: EASE }}
                className={cn("border-b", item.tone ?? "board-site")}
              >
                <Link to={item.to} onClick={onClose} aria-current={active ? "page" : undefined} className="group flex items-end justify-between gap-4 py-4">
                  <span>
                    <span
                      className={cn(
                        "flex items-center gap-3 font-display text-[44px] leading-none font-extrabold uppercase transition-colors group-hover:text-board",
                        active && "text-board",
                      )}
                    >
                      {item.label}
                      {active && (
                        <span className="rounded-full border border-board px-2 py-0.5 font-sans text-[11px] font-semibold tracking-[0.12em] text-board">
                          YOU'RE HERE
                        </span>
                      )}
                    </span>
                    <span className="mt-1.5 block text-sm text-muted-foreground">{item.hint}</span>
                  </span>
                  <ArrowUpRight aria-hidden="true" className="size-6 shrink-0 text-subtle transition-transform group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-board" />
                </Link>
              </motion.li>
            );
          })}
        </ul>
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4, ease: EASE }}
          className="flex flex-col gap-2.5"
        >
          {boards.map((b) => (
            <Link
              key={b.newPath}
              to={b.newPath}
              onClick={onClose}
              className={cn(b.tone, "inline-flex h-14 items-center justify-center rounded-full bg-board text-[17px] font-semibold text-board-foreground")}
            >
              {b.postCta}
            </Link>
          ))}
        </motion.div>
      </nav>
    </motion.div>
  );
}

function Footer() {
  const reduce = useReducedMotion();
  const wordmark = useRef<HTMLDivElement>(null);
  const filled = useInView(wordmark, { amount: 0.3 });

  const columns: { heading: string; links: { to: string; label: string; external?: boolean }[] }[] = [
    {
      heading: "Boards",
      links: boards.map((b) => ({ to: b.path, label: b.board })),
    },
    {
      heading: "Post",
      links: boards.map((b) => ({ to: b.newPath, label: b.postCta })),
    },
    {
      heading: "More",
      links: [
        { to: "/alerts", label: "Alerts" },
        { to: "/me", label: "Me: profile & posts" },
        { to: "/help", label: "Help" },
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
          <p className="mt-3 max-w-72 text-[15px] leading-relaxed text-muted-foreground">
            The free board for underground futsal across Bangladesh. No sign-up, no fees, no ads.
          </p>
        </div>
        {columns.map((column) => (
          <div key={column.heading}>
            <h2 className="font-display text-lg font-bold tracking-[0.08em] text-primary uppercase">{column.heading}</h2>
            <ul className="mt-4 flex flex-col gap-1 text-[15px]">
              {column.links.map((link) => (
                <li key={link.label}>
                  {link.external ? (
                    <a href={link.to} target="_blank" rel="noopener noreferrer" className="link-draw inline-flex min-h-9 items-center text-foreground/90 hover:text-primary">
                      {link.label}
                    </a>
                  ) : (
                    <Link to={link.to} className="link-draw inline-flex min-h-9 items-center text-foreground/90 hover:text-primary">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Watch the wrapper, not the clipped text: a fully clipped element never counts as visible. */}
      <div ref={wordmark} aria-hidden="true" className="relative page-x pb-3 select-none">
        <p
          className="text-outline font-display text-[15.5vw] leading-[0.92] font-extrabold whitespace-nowrap uppercase xl:text-[11.5rem]"
          style={{ "--outline": "var(--line)" } as React.CSSProperties}
        >
          Khelbi Naki?
        </p>
        {/* The giant wordmark fills with lime, left to right, each time it comes into view. */}
        <p
          style={{
            clipPath: reduce || filled ? "inset(0 0 0 0)" : "inset(0 100% 0 0)",
            transition: reduce ? undefined : "clip-path 1.4s cubic-bezier(0.76, 0, 0.24, 1)",
          }}
          className="absolute inset-y-0 left-5 font-display text-[15.5vw] leading-[0.92] font-extrabold whitespace-nowrap text-primary uppercase md:left-10 xl:text-[11.5rem]"
        >
          Khelbi Naki?
        </p>
      </div>

      <div className="page-x flex flex-col gap-1 border-t py-6 text-[13px] text-muted-foreground sm:flex-row sm:justify-between">
        <span>Free forever. Made for futsal across Bangladesh.</span>
        <span>Contact happens on WhatsApp. Numbers are never listed on the board.</span>
      </div>
    </footer>
  );
}
