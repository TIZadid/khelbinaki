import { type HTMLAttributes, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * A card with a soft lime glow that follows the mouse (see .spotlight in index.css).
 * Only a CSS variable changes, so there are no re-renders.
 */
export function Spotlight({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      {...rest}
      onPointerMove={(event) => {
        const el = ref.current;
        if (!el || event.pointerType !== "mouse") return;
        const box = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${event.clientX - box.left}px`);
        el.style.setProperty("--my", `${event.clientY - box.top}px`);
      }}
      className={cn("spotlight", className)}
    >
      {children}
    </div>
  );
}
