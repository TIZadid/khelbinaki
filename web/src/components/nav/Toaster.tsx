import { AlertCircle, CheckCircle2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { type Toast, onToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/** Short confirmations that float up above the tab bar and leave on their own. */
export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(
    () =>
      onToast((t) => {
        setToasts((all) => [...all.slice(-2), t]);
        window.setTimeout(() => setToasts((all) => all.filter((x) => x.id !== t.id)), 2800);
      }),
    [],
  );

  return (
    <div
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h)+1rem)] z-[70] flex flex-col items-center gap-2 px-4 md:bottom-8"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.p
            key={t.id}
            layout
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            className={cn(
              "flex items-center gap-2.5 rounded-full border bg-card/95 px-5 py-3 text-[15px] font-semibold shadow-[0_20px_50px_-20px_rgb(0_0_0/0.9)] backdrop-blur",
              t.tone === "ok" ? "border-primary/40" : "border-destructive/60",
            )}
          >
            {t.tone === "ok" ? (
              <CheckCircle2 aria-hidden="true" className="size-5 text-primary" />
            ) : (
              <AlertCircle aria-hidden="true" className="size-5 text-destructive" />
            )}
            {t.message}
          </motion.p>
        ))}
      </AnimatePresence>
    </div>
  );
}
