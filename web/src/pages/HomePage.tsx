import { ArrowDownRight } from "lucide-react";
import type { CSSProperties } from "react";
import { Feed } from "@/components/feed/Feed";
import { CountUp } from "@/components/motion/CountUp";
import { FadeUp } from "@/components/motion/FadeUp";
import { RevealWords } from "@/components/motion/RevealWords";
import { NextUpTicket } from "@/components/NextUpTicket";
import { useAsync } from "@/hooks/useAsync";
import { useNow } from "@/hooks/useNow";
import { fetchFeed } from "@/lib/api";
import { Link } from "@/lib/router";
import { btn } from "@/lib/ui";
import { cn } from "@/lib/utils";

// What's next, so hosts and keepers can see where this is going.
const upcoming = [
  {
    title: "Find an opponent team",
    body: "Post that your team needs a match, not just a keeper. Same board, same one-tap contact.",
    when: "Next",
  },
  {
    title: "Past games",
    body: "A history page, so you can repost last week's game in two taps.",
    when: "Later",
  },
  {
    title: "Bangla",
    body: "The whole site in Bangla, alerts included.",
    when: "Later",
  },
];

const steps = [
  { n: "01", title: "Post your match", body: "Turf, time and cost per head. Thirty seconds, no sign-up." },
  { n: "02", title: "Keepers find you", body: "Keepers near you browse open games and pick the ones that suit them." },
  { n: "03", title: "Settle it on WhatsApp", body: "They message you directly. Mark it filled when you're sorted." },
];

export function HomePage() {
  const { state, retry } = useAsync(fetchFeed, []);
  const now = useNow();

  const posts = state.status === "ready" ? state.data : [];
  const openCount = posts.filter((p) => p.status === "open").length;
  const next = posts.find((p) => p.status === "open" && new Date(p.start_datetime) > now);

  return (
    <>
      <section className="page-x flex flex-col gap-12 pt-12 pb-16 md:flex-row md:items-end md:gap-16 md:pt-26 md:pb-30">
        <div className="flex min-w-0 flex-1 flex-col gap-6 md:gap-8">
          <FadeUp>
            <p className="eyebrow flex items-center gap-3">
              <span aria-hidden="true" className="relative flex size-2">
                <span className="absolute inline-flex size-full rounded-full bg-primary opacity-75 motion-safe:animate-ping" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              {openCount > 0 ? (
                <>
                  <CountUp value={openCount} /> open {openCount === 1 ? "game" : "games"} right now
                </>
              ) : (
                "Live board"
              )}{" "}
              · across Bangladesh
            </p>
          </FadeUp>
          <FadeUp delay={0.05}>
            {/* The words animate in their own masked blocks, which would otherwise
                read as "Need akeeper?", so the heading states its own name. */}
            <h1
              aria-label="Need a keeper?"
              className="on-pitch font-display text-[clamp(5.5rem,14vw,11.5rem)] leading-[0.84] font-extrabold tracking-[-0.01em] uppercase"
            >
              <RevealWords text="Need a" className="block" />{" "}
              <RevealWords text="keeper?" className="block" wordClassName="text-primary" delay={0.12} />
            </h1>
          </FadeUp>
          <FadeUp delay={0.1}>
            <p className="max-w-[32.5rem] text-[17px] leading-relaxed text-muted-foreground md:text-xl">
              The free board for underground futsal. Hosts post the gap, keepers pick the game, and it's settled on
              WhatsApp. No sign-up.
            </p>
          </FadeUp>
          <FadeUp delay={0.15}>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a href="#games" className={cn(btn.primary, "w-full sm:w-auto")}>
                See open games <ArrowDownRight aria-hidden="true" className="size-[18px]" />
              </a>
              <Link to="/new" className={cn(btn.outline, "h-14 px-7 text-[17px]")}>
                Post a match
              </Link>
            </div>
          </FadeUp>
        </div>
        {next && (
          <FadeUp delay={0.2} className="md:w-[27.5rem] md:shrink-0">
            <NextUpTicket post={next} now={now} />
          </FadeUp>
        )}
      </section>

      <Feed state={state} retry={retry} now={now} />

      <section id="next" aria-labelledby="next-heading" className="border-t">
        <div className="page-x py-14 md:py-24">
          <h2 id="next-heading" className="eyebrow mb-7 md:mb-10">
            Coming next
          </h2>
          <ul className="grid gap-px overflow-hidden rounded-2xl border bg-border md:grid-cols-3">
            {upcoming.map((item) => (
              <li key={item.title} className="bg-background p-5 md:p-6">
                <span
                  className={cn(
                    "inline-block rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.12em] uppercase",
                    item.when === "Next" ? "border-primary text-primary" : "border-line text-subtle",
                  )}
                >
                  {item.when}
                </span>
                <h3 className="mt-3.5 font-display text-2xl font-bold uppercase">{item.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-[15px] text-subtle">
            Want something else?{" "}
            <a
              href="https://github.com/TIZadid/khelbinaki/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              Tell us here
            </a>
            .
          </p>
        </div>
      </section>

      <section id="how" aria-labelledby="how-heading" className="border-t">
        <div className="page-x py-14 md:py-30">
          <h2 id="how-heading" className="eyebrow mb-7 md:mb-14">
            How it works
          </h2>
          <ol aria-label="How it works" className="grid md:grid-cols-3">
            {steps.map((s, i) => (
              <li
                key={s.n}
                className={cn(
                  "flex gap-5 border-t py-5 md:block md:border-t-0 md:py-0",
                  i < 2 && "md:border-r",
                  i === 0 ? "md:pr-12" : i === 1 ? "md:px-12" : "md:pl-12",
                )}
              >
                <p
                  aria-hidden="true"
                  className="text-outline w-19 shrink-0 font-display text-[76px] leading-[0.8] font-extrabold md:w-auto md:text-[160px]"
                  style={{ "--outline": i === 0 ? "var(--primary)" : "#4a5342" } as CSSProperties}
                >
                  {s.n}
                </p>
                <div>
                  <h3 className="font-display text-2xl font-bold uppercase md:mt-10 md:text-[32px]">{s.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground md:mt-3 md:text-[17px]">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
