import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { Link } from "@/lib/router";
import { PitchBackground } from "./PitchBackground";

function Brand({ className }: { className?: string }) {
  return (
    <span className={className}>
      Khelbi <span className="text-primary">Naki?</span>
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-dvh flex-col">
        <PitchBackground />
        <header className="border-b">
          <div className="page-x flex h-17 items-center justify-between md:h-22">
            <Link to="/" className="font-display text-2xl font-extrabold tracking-[0.02em] uppercase md:text-[28px]">
              <Brand />
            </Link>
            <nav aria-label="Main" className="hidden items-center gap-9 text-[15px] font-medium text-muted-foreground sm:flex">
              <a href="/#games" className="hover:text-foreground">
                Open games
              </a>
              <a href="/#how" className="hover:text-foreground">
                How it works
              </a>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t">
          <div className="page-x flex flex-col gap-2 py-8 text-sm text-subtle md:h-30 md:flex-row md:items-center md:justify-between md:py-0">
            <Brand className="font-display text-[22px] font-extrabold text-foreground uppercase" />
            <span>Free forever. Made for futsal across Bangladesh.</span>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}
