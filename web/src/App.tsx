import { AppShell } from "@/components/AppShell";
import { GlowCard } from "@/components/GlowCard";
import { FadeUp } from "@/components/motion/FadeUp";

const steps = [
  { n: "01", title: "Post your match", body: "Turf, time and cost per head. Takes 30 seconds, no sign-up." },
  { n: "02", title: "Keepers find you", body: "Goalkeepers across Dhaka browse tonight's open games." },
  { n: "03", title: "Settle it on WhatsApp", body: "They message you directly. Mark it filled when you're sorted." },
];

export default function App() {
  return (
    <AppShell>
      <section className="py-16 text-center sm:py-24">
        <FadeUp>
          <h1 className="text-4xl font-bold sm:text-6xl">
            Need a <span className="text-primary">keeper</span> tonight?
          </h1>
        </FadeUp>
        <FadeUp delay={0.1}>
          <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
            The free board for underground futsal in Bangladesh. Post that you need a goalkeeper,
            or pick up a game in goal near you.
          </p>
        </FadeUp>
      </section>

      <ol className="grid gap-4 pb-16 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.n}>
            <FadeUp delay={0.1 * i} className="h-full">
              <GlowCard highlighted={i === 1} className="h-full">
                <p className="font-display text-sm font-bold">{s.n}.</p>
                <h2 className="mt-3 text-lg font-semibold">{s.title}</h2>
                <p className={i === 1 ? "mt-2 text-sm" : "mt-2 text-sm text-muted-foreground"}>
                  {s.body}
                </p>
              </GlowCard>
            </FadeUp>
          </li>
        ))}
      </ol>
    </AppShell>
  );
}
