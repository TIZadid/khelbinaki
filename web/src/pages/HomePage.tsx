import { ArrowDownRight } from "lucide-react";
import { Feed } from "@/components/feed/Feed";
import { GlowCard } from "@/components/GlowCard";
import { FadeUp } from "@/components/motion/FadeUp";

const steps = [
  { n: "01", title: "Post your match", body: "Turf, time and cost per head. Takes 30 seconds, no sign-up." },
  { n: "02", title: "Keepers find you", body: "Keepers near you browse open games and pick the ones that suit them." },
  { n: "03", title: "Settle it on WhatsApp", body: "They message you directly. Mark it filled when you're sorted." },
];

export function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden py-14 text-center sm:py-20">
        <span
          aria-hidden="true"
          className="text-outline pointer-events-none absolute inset-x-0 top-1/2 -z-10 -translate-y-1/2 font-condensed text-[26vw] leading-none font-bold uppercase select-none sm:text-[15rem]"
        >
          Khelbi
        </span>
        <FadeUp>
          <h1 className="text-4xl font-bold sm:text-6xl">
            Need a <span className="text-primary">keeper</span> for your match?
          </h1>
        </FadeUp>
        <FadeUp delay={0.1}>
          <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
            The free board for underground futsal in Bangladesh. Post that you need a goalkeeper,
            or pick up a game in goal near you.
          </p>
        </FadeUp>
        <FadeUp delay={0.2}>
          <a
            href="#games"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
          >
            See open games <ArrowDownRight aria-hidden="true" className="size-4" />
          </a>
        </FadeUp>
      </section>

      <Feed />

      <section aria-labelledby="how-heading" className="pb-16">
        <h2 id="how-heading" className="mb-6 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
          How it works
        </h2>
        <ol aria-label="How it works" className="grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.n}>
              <FadeUp delay={0.1 * i} className="h-full">
                <GlowCard highlighted={i === 1} className="h-full">
                  <p className="font-condensed text-6xl leading-none font-bold">{s.n}</p>
                  <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                  <p className={i === 1 ? "mt-2 text-sm" : "mt-2 text-sm text-muted-foreground"}>{s.body}</p>
                </GlowCard>
              </FadeUp>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
