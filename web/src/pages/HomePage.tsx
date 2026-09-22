import { ArrowDownRight } from "lucide-react";
import type { CSSProperties } from "react";
import { Feed } from "@/components/feed/Feed";
import { FadeUp } from "@/components/motion/FadeUp";
import { NextUpTicket } from "@/components/NextUpTicket";
import { useAsync } from "@/hooks/useAsync";
import { useNow } from "@/hooks/useNow";
import { fetchFeed } from "@/lib/api";
import { Link } from "@/lib/router";
import { btn } from "@/lib/ui";
import { cn } from "@/lib/utils";

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
              <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
              {openCount > 0 ? `${openCount} open ${openCount === 1 ? "game" : "games"} right now` : "Live board"} ·
              across Bangladesh
            </p>
          </FadeUp>
          <FadeUp delay={0.05}>
            <h1 className="font-display text-[clamp(5.5rem,14vw,11.5rem)] leading-[0.84] font-extrabold tracking-[-0.01em] uppercase">
              <span className="block">Need a</span>{" "}
              <span className="block text-primary">keeper?</span>
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
              <Link to="/keeper" className={cn(btn.outline, "h-14 px-7 text-[17px]")}>
                I'm a keeper
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
