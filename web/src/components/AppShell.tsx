import { MotionConfig, motion } from "motion/react";
import type { ReactNode } from "react";
import { useKeeperProfile } from "@/hooks/useKeeperProfile";
import { Brand } from "@/components/Brand";
import { Link, usePath } from "@/lib/router";
import { PitchBackground } from "./PitchBackground";

export function AppShell({ children }: { children: ReactNode }) {
  const keeper = useKeeperProfile();
  const path = usePath();

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-dvh flex-col">
        <PitchBackground />
        <header className="border-b">
          <div className="page-x flex h-17 items-center justify-between md:h-22">
            <Brand className="font-display text-2xl font-extrabold tracking-[0.02em] uppercase md:text-[28px]" />
            <div className="flex items-center gap-6 md:gap-9">
              <nav aria-label="Main" className="hidden items-center gap-9 text-[15px] font-medium text-muted-foreground sm:flex">
                <a href="/#games" className="hover:text-foreground">
                  Open games
                </a>
                <a href="/#how" className="hover:text-foreground">
                  How it works
                </a>
              </nav>
              <Link to="/keeper" className="text-sm font-semibold text-muted-foreground hover:text-foreground md:text-[15px]">
                {keeper ? "My profile" : "I'm a keeper"}
              </Link>
              <Link
                to="/new"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-primary px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground md:px-5"
              >
                Post a match
              </Link>
            </div>
          </div>
        </header>
        <motion.main
          key={path}
          className="flex-1"
          // Slide only: fading the whole page would empty it from the accessibility
          // tree (and hide everything if the animation ever stalled).
          initial={{ y: 10 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.main>
        <footer className="border-t">
          <div className="page-x flex flex-col gap-2 py-8 text-sm text-subtle md:h-30 md:flex-row md:items-center md:justify-between md:py-0">
            <Brand className="font-display text-[22px] font-extrabold text-foreground uppercase" />
            <span>Free forever. Made for futsal across Bangladesh.</span>
            <Link to="/cha" className="hover:text-foreground">
              Buy me a cha
            </Link>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}
