import { Check, Copy, Share2, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { PublicPost } from "@/lib/api";
import { postUrl } from "@/lib/contact";
import { canUseShareSheet, openShareSheet, shareTargets } from "@/lib/share";
import { btn } from "@/lib/ui";
import { cn } from "@/lib/utils";

/**
 * Phones open the system share sheet (Facebook, Messenger, WhatsApp, imo, Viber…).
 * Everywhere else, a small panel with the big destinations plus copy link.
 */
export function ShareButton({
  post,
  className,
  children,
  label = "Share",
}: {
  post: PublicPost;
  className?: string;
  children?: ReactNode;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  const onShare = async () => {
    if (canUseShareSheet() && (await openShareSheet(post, origin))) return;
    setOpen(true);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl(post.id, origin));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <button type="button" onClick={onShare} aria-label={label} className={cn(btn.outline, className)}>
        {children ?? (
          <>
            <Share2 aria-hidden="true" className="size-4" /> {label}
          </>
        )}
      </button>

      {open && (
        <>
          <div aria-hidden="true" onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-[#050604]/70" />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-dialog-heading"
            className="fixed inset-x-0 bottom-0 z-40 rounded-t-[28px] border-t border-line bg-card px-5 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] text-left md:inset-0 md:m-auto md:h-fit md:max-w-md md:rounded-3xl md:border md:p-7"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 id="share-dialog-heading" className="font-display text-[34px] leading-none font-extrabold uppercase">
                Share this game
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className={cn(btn.icon, "text-muted-foreground")}
              >
                <X aria-hidden="true" className="size-[18px]" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              {shareTargets(post, origin).map((target) => (
                <a
                  key={target.key}
                  href={target.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    btn.outline,
                    "h-12",
                    target.key === "whatsapp" && "border-primary bg-primary text-primary-foreground hover:text-primary-foreground",
                  )}
                >
                  {target.label}
                </a>
              ))}
              <button type="button" onClick={copyLink} className={cn(btn.outline, "h-12")}>
                {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>

            <p className="mt-4 text-[13px] leading-relaxed text-subtle">
              On Facebook you can pick "Share to a group". The link shows the match details as a preview card.
            </p>
          </section>
        </>
      )}
    </>
  );
}
