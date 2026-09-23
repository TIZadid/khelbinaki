import { ArrowUpRight, Phone, X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { isOpponent } from "@/lib/listing";
import { lockScroll } from "@/lib/smoothScroll";
import { Turnstile } from "@/components/Turnstile";
import { type PublicPost, revealPhone } from "@/lib/api";
import { formatPhone, telUrl, whatsappContactUrl } from "@/lib/contact";
import { btn } from "@/lib/ui";
import { cn } from "@/lib/utils";

type State =
  | { status: "checking" }
  | { status: "revealed"; phone: string }
  | { status: "error"; message: string };

const EASE = [0.22, 1, 0.36, 1] as const;

const messages = (opponent: boolean): Record<string, string> => ({
  closed: opponent ? "This team has already found an opponent." : "This game is no longer taking keepers.",
  not_found: "This post was removed.",
  captcha_failed: "The spam check didn't pass. Close this and try again.",
});

// Direct-contact posts: the host's number appears only after a spam check.
export function ContactSheet({ post, onClose }: { post: PublicPost; onClose: () => void }) {
  const [state, setState] = useState<State>({ status: "checking" });
  const opponent = isOpponent(post);
  const who = opponent ? (post.team_name ?? post.host_name) : post.host_name;

  useEffect(() => {
    lockScroll(true);
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      lockScroll(false);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const onToken = async (token: string) => {
    const result = await revealPhone(post.id, token);
    if (result.ok) setState({ status: "revealed", phone: result.phone });
    else setState({ status: "error", message: messages(opponent)[result.failure.error] ?? "Something went wrong. Try again." });
  };

  return (
    <>
      <motion.div
        aria-hidden="true"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-50 bg-[#050604]/70 backdrop-blur-sm"
      />
      <motion.section
        data-lenis-prevent
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.4, ease: EASE }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-heading"
        className="fixed inset-x-0 bottom-0 z-[55] rounded-t-[28px] border-t border-line bg-card px-5 pt-3 pb-[max(2rem,env(safe-area-inset-bottom))] md:inset-0 md:m-auto md:h-fit md:max-w-lg md:rounded-3xl md:border md:px-8 md:pt-6 md:pb-8"
      >
        <div aria-hidden="true" className="mx-auto h-1 w-11 rounded-full bg-[#3a4233] md:hidden" />
        <div className="mt-5 flex items-start justify-between gap-4 md:mt-0">
          <div>
            <h2 id="contact-heading" className="eyebrow">
              {state.status === "revealed" ? `${post.host_name}'s number` : opponent ? `Contact ${who}` : `Contact ${post.host_name}`}
            </h2>
            {state.status === "revealed" && (
              <p className="mt-2 font-display text-[52px] leading-none font-bold tracking-[0.01em]">
                {formatPhone(state.phone)}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={cn(btn.icon, "text-muted-foreground")}>
            <X aria-hidden="true" className="size-[18px]" />
          </button>
        </div>

        {state.status === "checking" && (
          <div className="mt-5">
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              One quick check that you're human, then you get {post.host_name}'s number.
            </p>
            <div className="mt-4">
              <Turnstile
                onToken={onToken}
                onError={() => setState({ status: "error", message: "The spam check couldn't load. Check your connection." })}
              />
            </div>
          </div>
        )}

        {state.status === "error" && (
          <p role="alert" className="mt-5 text-[15px] text-muted-foreground">
            {state.message}
          </p>
        )}

        {state.status === "revealed" && (
          <>
            <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">
              {opponent
                ? "WhatsApp opens with a message about this match. Only get in touch if your team can make this time."
                : "WhatsApp opens with a message about this game. Only get in touch if you can play in goal."}
            </p>
            <div className="mt-5 flex flex-col gap-2.5">
              <a
                href={whatsappContactUrl(post, window.location.origin, state.phone)}
                target="_blank"
                rel="noopener noreferrer"
                className={btn.primary}
              >
                WhatsApp {post.host_name} <ArrowUpRight aria-hidden="true" className="size-[18px]" />
              </a>
              <a href={telUrl(state.phone)} className={cn(btn.outline, "h-14 text-[17px]")}>
                <Phone aria-hidden="true" className="size-[18px]" /> Call
              </a>
            </div>
          </>
        )}
      </motion.section>
    </>
  );
}
