import { ArrowDown, ArrowUpRight, Plus } from "lucide-react";
import { type MotionValue, motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { type CSSProperties, useEffect, useRef } from "react";
import { Feed } from "@/components/feed/Feed";
import { HeroBall } from "@/components/hero/HeroBall";
import { CountUp } from "@/components/motion/CountUp";
import { FadeUp } from "@/components/motion/FadeUp";
import { Magnetic } from "@/components/motion/Magnetic";
import { Marquee } from "@/components/motion/Marquee";
import { RevealWords } from "@/components/motion/RevealWords";
import { Spotlight } from "@/components/motion/Spotlight";
import { NextUpTicket } from "@/components/NextUpTicket";
import type { AsyncState } from "@/hooks/useAsync";
import { useAsync } from "@/hooks/useAsync";
import { useNow } from "@/hooks/useNow";
import { fetchFeed, type PublicPost } from "@/lib/api";
import { LISTINGS, type ListingType } from "@/lib/listing";
import { Link } from "@/lib/router";
import { scrollToTarget } from "@/lib/smoothScroll";
import { btn } from "@/lib/ui";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

const steps = [
  {
    n: "01",
    title: "Post the gap",
    body: "Need a keeper, or a team to play against? Turf, time, how many a side and the cost. Thirty seconds, no sign-up.",
  },
  {
    n: "02",
    title: "Players find you",
    body: "Keepers browse GK Lagbe, teams browse Opponent Lagbe. They pick the games near them that suit them.",
  },
  {
    n: "03",
    title: "Settle it on WhatsApp",
    body: "They message you, or leave their number for you to pick from. Mark the post filled once you're sorted.",
  },
];

const marquee = ["GK Lagbe", "Opponent Lagbe", "5-a-side", "6-a-side", "7-a-side", "Free forever", "No sign-up", "Khelbi naki?"];

export function HomePage() {
  const { state, retry } = useAsync(fetchFeed, []);
  const now = useNow();

  const posts = state.status === "ready" ? state.data : [];
  const openOf = (type: ListingType) => posts.filter((p) => p.listing_type === type && p.status === "open").length;
  const next = posts.find((p) => p.status === "open" && new Date(p.start_datetime) > now);

  // "/#opponent-lagbe" lands before the boards have loaded; once they're in, the
  // rows above have pushed the target down, so aim again.
  const ready = state.status === "ready";
  useEffect(() => {
    const hash = window.location.hash;
    if (ready && /^#[a-z-]+$/.test(hash) && document.querySelector(hash)) {
      requestAnimationFrame(() => scrollToTarget(hash, true));
    }
  }, [ready]);

  return (
    <>
      <Hero state={state} openOf={openOf} />
      <Marquee items={marquee} />

      {next && (
        <section aria-labelledby="next-heading" className="page-x grid items-center gap-10 pt-20 md:grid-cols-[1fr_27.5rem] md:gap-16 md:pt-28">
          <div>
            <p className="eyebrow text-board">Next kick-off</p>
            <h2 id="next-heading" className="on-pitch mt-4 font-display text-[56px] leading-[0.86] font-extrabold uppercase md:text-[88px]">
              <RevealWords text="The ball rolls" inView className="block" />
              <RevealWords text="soon." inView delay={0.1} className="block" wordClassName="text-board" />
            </h2>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-muted-foreground">
              The soonest open post on either board. Seats like this go fast — if it suits you, get in touch now.
            </p>
          </div>
          <FadeUp>
            <NextUpTicket post={next} now={now} />
          </FadeUp>
        </section>
      )}

      <Feed type="gk_needed" index="01" state={state} retry={retry} now={now} />
      <Feed type="opponent_needed" index="02" state={state} retry={retry} now={now} />

      <HowItWorks />
      <Closing />
    </>
  );
}

function Hero({ state, openOf }: { state: AsyncState<PublicPost[]>; openOf: (type: ListingType) => number }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  // As the hero scrolls away, the copy drifts up slower than the page and the ball sinks back.
  const textY = useTransform(scrollYProgress, [0, 1], [0, -90]);
  const ballY = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const ballScale = useTransform(scrollYProgress, [0, 1], [1, 0.82]);
  const total = openOf("gk_needed") + openOf("opponent_needed");

  return (
    <section ref={ref} aria-labelledby="hero-heading" className="relative isolate overflow-hidden">
      <motion.div
        style={reduce ? undefined : { y: ballY, scale: ballScale }}
        className="absolute inset-x-0 top-0 -z-10 mx-auto size-[96vw] max-h-[680px] max-w-[680px] sm:inset-x-auto sm:-right-[8%] sm:mx-0 sm:size-[62vw] md:top-[8%] md:right-0 md:size-[46vw] xl:right-[2%]"
      >
        <HeroBall className="size-full" />
      </motion.div>

      <motion.div
        style={reduce ? undefined : { y: textY }}
        className="page-x pointer-events-none flex min-h-[calc(100svh-4.25rem)] flex-col justify-end gap-7 pt-[84vw] pb-14 sm:pt-[30vw] md:min-h-[calc(100svh-5rem)] md:justify-center md:gap-7 md:pt-8 md:pb-20"
      >
        <FadeUp>
          <p className="eyebrow flex items-center gap-3">
            <span aria-hidden="true" className="relative flex size-2">
              <span className="absolute inline-flex size-full rounded-full bg-board opacity-75 motion-safe:animate-ping" />
              <span className="relative inline-flex size-2 rounded-full bg-board" />
            </span>
            {/* One text run, so the count never wraps apart from its words. */}
            <span>
              {total > 0 ? (
                <>
                  <CountUp value={total} /> open {total === 1 ? "post" : "posts"} right now
                </>
              ) : (
                "Live board"
              )}{" "}
              · underground futsal · Bangladesh
            </span>
          </p>
        </FadeUp>

        {/* The words animate in their own masked blocks, so the heading states its own name. */}
        <h1
          id="hero-heading"
          aria-label="Khelbi Naki?"
          className="on-pitch font-display text-[clamp(5.75rem,21vw,13rem)] md:text-[14vw] xl:text-[13rem] leading-[0.8] font-extrabold tracking-[-0.015em] uppercase"
        >
          <RevealWords text="Khelbi" className="block" />
          <RevealWords text="Naki?" className="block" wordClassName="text-board" delay={0.12} />
        </h1>

        <FadeUp delay={0.15}>
          <p className="max-w-[34rem] text-[17px] leading-relaxed text-muted-foreground md:text-xl">
            The free board for underground futsal. <span className="text-foreground">Need a keeper?</span> Post it on GK
            Lagbe. <span className="text-foreground">Looking for a team to play?</span> Post it on Opponent Lagbe. Settle
            it on WhatsApp. No sign-up.
          </p>
        </FadeUp>

        <div className="pointer-events-auto grid gap-3 sm:grid-cols-2 md:max-w-[46rem]">
          {(["gk_needed", "opponent_needed"] as const).map((type, i) => (
            <motion.div
              key={type}
              initial={reduce ? false : { opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35 + i * 0.1, ease: EASE }}
            >
              <LaneCard type={type} count={state.status === "ready" ? openOf(type) : null} n={`0${i + 1}`} />
            </motion.div>
          ))}
        </div>
      </motion.div>

      <a
        href="#gk-lagbe"
        aria-label="Scroll to the boards"
        className="absolute right-10 bottom-8 hidden flex-col items-center gap-2 text-[11px] font-semibold tracking-[0.3em] text-subtle uppercase hover:text-foreground md:flex"
      >
        Scroll
        <span aria-hidden="true" className="relative h-10 w-px overflow-hidden bg-line">
          <span className="absolute inset-x-0 top-0 h-1/2 bg-board motion-safe:animate-[scroll-cue_1.8s_ease-in-out_infinite]" />
        </span>
      </a>
    </section>
  );
}

function LaneCard({ type, count, n }: { type: ListingType; count: number | null; n: string }) {
  const copy = LISTINGS[type];
  return (
    <Spotlight className={cn(copy.tone, "group flex h-full flex-col rounded-3xl border border-[#242a1f] bg-card/80 p-5 backdrop-blur-md transition-colors duration-300 hover:border-line md:p-6")}>
      <div className="flex items-center justify-between text-[11px] font-semibold tracking-[0.18em] uppercase">
        <span className="flex items-center gap-2 text-muted-foreground">
          <span aria-hidden="true" className={cn("size-[7px] rounded-full", count ? "bg-board" : "bg-line")} />
          {count === null ? "Loading" : `${count} open`}
        </span>
        <span className="text-subtle">{n}</span>
      </div>
      <h2 className="mt-5 font-display text-[40px] leading-[0.9] font-extrabold uppercase md:text-[46px]">{copy.board}</h2>
      <p className="mt-1.5 text-[15px] text-muted-foreground">{copy.tagline}</p>
      <div className="mt-6 flex items-center justify-between gap-3 border-t pt-4">
        <Link to={`/#${copy.anchor}`} className="link-draw inline-flex items-center gap-1.5 text-sm font-semibold">
          Browse <ArrowDown aria-hidden="true" className="size-4 transition-transform group-hover:translate-y-0.5" />
        </Link>
        <Link
          to={copy.newPath}
          className={cn(
            "inline-flex h-10 items-center gap-1.5 rounded-full bg-board px-4 text-sm font-semibold text-board-foreground transition-[background-color,transform] duration-150 hover:bg-board/90 active:scale-[0.97]",
          )}
        >
          <Plus aria-hidden="true" className="size-4" /> {copy.postCta}
        </Link>
      </div>
    </Spotlight>
  );
}

function HowItWorks() {
  const ref = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 55%"] });

  return (
    <section id="how" aria-labelledby="how-heading" className="scroll-mt-20 border-t">
      <div className="page-x py-20 md:py-32">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-4 md:mb-20">
          <h2 id="how-heading" className="on-pitch font-display text-[56px] leading-[0.86] font-extrabold uppercase md:text-[96px]">
            <RevealWords text="How it" inView className="block" />
            <RevealWords text="works" inView delay={0.08} className="block" wordClassName="text-board" />
          </h2>
          <p className="max-w-sm text-[15px] leading-relaxed text-muted-foreground md:text-[17px]">
            Same three steps whether you need a keeper or a team to play. Nobody signs up, nobody pays.
          </p>
        </div>

        <div className="relative">
          {/* On desktop a line fills across the steps as they scroll by; on phones the numerals light up alone. */}
          <div aria-hidden="true" className="absolute inset-x-0 top-0 hidden h-px bg-line md:block">
            <motion.div style={{ scaleX: scrollYProgress }} className="absolute inset-0 origin-left bg-board" />
          </div>
          <ol ref={ref} aria-label="How it works" className="grid gap-10 md:grid-cols-3 md:gap-0">
            {steps.map((step, i) => (
              <Step key={step.n} step={step} i={i} progress={scrollYProgress} />
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function Step({ step, i, progress }: { step: (typeof steps)[number]; i: number; progress: MotionValue<number> }) {
  const start = i / 3;
  // Each numeral lights up lime as the line reaches it.
  const outline = useTransform(progress, [start, start + 0.12], ["#4a5342", "#94c11a"]);
  const dot = useTransform(progress, [start, start + 0.05], ["#2b3226", "#94c11a"]);

  return (
    <li className={cn("relative flex gap-6 md:block md:pt-12", i === 0 ? "md:pr-12" : i === 1 ? "md:px-12" : "md:pl-12")}>
      <motion.span
        aria-hidden="true"
        style={{ backgroundColor: dot }}
        className="absolute -top-1 left-0 hidden size-[9px] rounded-full md:block"
      />
      <motion.p
        aria-hidden="true"
        style={{ "--outline": outline } as unknown as CSSProperties}
        className="text-outline w-19 shrink-0 font-display text-[76px] leading-[0.8] font-extrabold md:w-auto md:text-[150px]"
      >
        {step.n}
      </motion.p>
      <div className="pt-1 md:pt-0">
        <h3 className="font-display text-[28px] leading-none font-bold uppercase md:mt-8 md:text-[34px]">{step.title}</h3>
        <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground md:mt-3 md:text-[17px]">{step.body}</p>
      </div>
    </li>
  );
}

function Closing() {
  return (
    <section aria-labelledby="closing-heading" className="relative overflow-hidden border-t">
      <div className="page-x flex flex-col items-center py-24 text-center md:py-36">
        <p className="eyebrow text-board">Your move</p>
        <h2 id="closing-heading" className="on-pitch mt-5 font-display text-[clamp(3.25rem,11vw,8rem)] leading-[0.84] font-extrabold uppercase">
          <RevealWords text="Need a keeper?" inView className="block" />
          <RevealWords text="Need a match?" inView delay={0.1} className="block" wordClassName="text-board" />
        </h2>
        <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-muted-foreground">
          Post it free. Players near you see it right away, and you settle the rest on WhatsApp.
        </p>
        <div className="mt-10 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Magnetic className="flex">
            <Link to={LISTINGS.gk_needed.newPath} className={cn(btn.primary, LISTINGS.gk_needed.tone, "w-full sm:w-auto")}>
              {LISTINGS.gk_needed.postCta} <ArrowUpRight aria-hidden="true" className="size-[18px]" />
            </Link>
          </Magnetic>
          <Magnetic className="flex">
            <Link
              to={LISTINGS.opponent_needed.newPath}
              className={cn(btn.outline, LISTINGS.opponent_needed.tone, "h-14 w-full border-board px-7 text-[17px] text-board sm:w-auto")}
            >
              {LISTINGS.opponent_needed.postCta} <ArrowUpRight aria-hidden="true" className="size-[18px]" />
            </Link>
          </Magnetic>
        </div>
        <p className="mt-10 text-[15px] text-subtle">
          Want something else on the board?{" "}
          <a
            href="https://github.com/TIZadid/khelbinaki/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="link-draw font-semibold text-board"
          >
            Tell us here
          </a>
          .
        </p>
      </div>
    </section>
  );
}
