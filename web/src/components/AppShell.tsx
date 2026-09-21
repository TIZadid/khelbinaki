import type { ReactNode } from "react";
import { GridBackground } from "./GridBackground";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <GridBackground />
      <header className="mx-auto flex w-full max-w-5xl items-center px-4 py-5">
        <span className="font-display text-lg font-bold">
          Khelbi <span className="text-primary">Naki?</span>
        </span>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4">{children}</main>
      <footer className="mx-auto w-full max-w-5xl px-4 py-8 text-sm text-muted-foreground">
        Free forever. Made for Dhaka futsal.
      </footer>
    </div>
  );
}
