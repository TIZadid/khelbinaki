import { type MouseEvent, type ReactNode, useRef } from "react";
import { cn } from "@/lib/utils";

export function GlowCard({
  children,
  className,
  highlighted = false,
}: {
  children: ReactNode;
  className?: string;
  highlighted?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onMouseMove(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      className={cn(
        "glow-card relative rounded-lg border p-5 transition-colors",
        highlighted
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card/80 text-card-foreground backdrop-blur hover:border-primary/40",
        className,
      )}
    >
      {children}
    </div>
  );
}
