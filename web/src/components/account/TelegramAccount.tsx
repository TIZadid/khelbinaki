import { BadgeCheck, Send } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Turnstile } from "@/components/Turnstile";
import type { AccountState } from "@/hooks/useAccount";
import { type SignInLinks, deleteAccount, pollSignIn, signInWithCode, signOut, startSignIn } from "@/lib/account";
import { formatPhone } from "@/lib/contact";
import { clearKeeperProfile } from "@/lib/keeper";
import { btn } from "@/lib/ui";
import { cn } from "@/lib/utils";

type Step = "idle" | "check" | "open" | "expired";

/**
 * Optional sign-in with Telegram: press Start in one of our bots and this page
 * signs in by itself; or, with no Telegram here, type the code /login sends.
 */
export function TelegramAccount({ account }: { account: AccountState }) {
  if (account.status === "loading") {
    return <div aria-busy="true" aria-label="Checking your sign-in" className="h-28 rounded-3xl bg-muted motion-safe:animate-pulse" />;
  }
  return account.status === "ready" ? <SignedIn name={account.account.name} phone={account.account.phone} /> : <SignedOut />;
}

function SignedIn({ name, phone }: { name: string; phone: string | null }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <section aria-labelledby="account-heading" className="rounded-3xl border border-primary/50 bg-card p-5 md:p-6">
      <p className="eyebrow text-primary">Signed in with Telegram</p>
      <h2 id="account-heading" className="mt-2 font-display text-[34px] leading-none font-extrabold uppercase">
        {name || "Your account"}
      </h2>
      <p className="mt-2 flex items-center gap-2 text-[15px] text-muted-foreground">
        {phone ? (
          <>
            <BadgeCheck aria-hidden="true" className="size-4 text-primary" /> {formatPhone(phone)} · verified on Telegram
          </>
        ) : (
          "No verified number yet — tap Share my number in the bot to add one."
        )}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-subtle">
        Your profile and your posts follow you to any phone you sign in on.
      </p>

      {confirm ? (
        <div className="mt-4 rounded-2xl border border-destructive/60 p-4">
          <p className="font-semibold">Delete your account and everything in it?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your profile, verified number and Telegram alerts go. Your posts stay up until they end, but no longer belong
            to an account.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                if (await deleteAccount()) clearKeeperProfile();
                else setFailed(true);
                setBusy(false);
              }}
              className={cn(btn.outline, "border-destructive text-destructive hover:border-destructive hover:text-destructive disabled:opacity-60")}
            >
              Yes, delete my data
            </button>
            <button type="button" onClick={() => setConfirm(false)} className={btn.outline}>
              Keep it
            </button>
          </div>
          {failed && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              Couldn't delete. Check your connection and try again.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => signOut()} className={btn.outline}>
            Sign out
          </button>
          <button type="button" onClick={() => setConfirm(true)} className={cn(btn.outline, "hover:border-destructive hover:text-destructive")}>
            Delete my data
          </button>
        </div>
      )}
    </section>
  );
}

function SignedOut() {
  const [step, setStep] = useState<Step>("idle");
  const [links, setLinks] = useState<SignInLinks | null>(null);
  const [error, setError] = useState("");
  const [withCode, setWithCode] = useState(false);

  // While the link is out, check every few seconds (and on coming back) until Start is pressed.
  useEffect(() => {
    if (step !== "open" || !links) return;
    let stopped = false;
    const check = async () => {
      const result = await pollSignIn(links.code);
      if (stopped) return;
      if (result === "expired") setStep("expired");
    };
    const id = window.setInterval(check, 2500);
    window.addEventListener("focus", check);
    return () => {
      stopped = true;
      window.clearInterval(id);
      window.removeEventListener("focus", check);
    };
  }, [step, links]);

  return (
    <section aria-labelledby="continue-heading" className="rounded-3xl border border-[#242a1f] bg-card p-5 md:p-6">
      <p className="eyebrow text-primary">Optional</p>
      <h2 id="continue-heading" className="mt-2 font-display text-[34px] leading-none font-extrabold uppercase">
        Continue with Telegram
      </h2>
      <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">
        Keep your profile and your posts on any phone. We only get your Telegram name — and your number if you choose to
        share it. Without this, everything stays on this phone.
      </p>

      {step === "idle" || step === "expired" ? (
        <div className="mt-4">
          {step === "expired" && <p className="mb-3 text-sm text-destructive">That sign-in link expired. Start again.</p>}
          <button type="button" onClick={() => setStep("check")} className={cn(btn.primary, "h-12 text-base")}>
            <Send aria-hidden="true" className="size-[18px]" /> Continue with Telegram
          </button>
        </div>
      ) : step === "check" ? (
        <div className="mt-4">
          <p className="mb-2 text-sm text-muted-foreground">One quick check that you're human…</p>
          <Turnstile
            onToken={async (token) => {
              const result = await startSignIn(token);
              if (!result) {
                setError("Couldn't start signing in. Try again.");
                setStep("idle");
                return;
              }
              setLinks(result);
              setStep("open");
            }}
            onError={() => {
              setError("The spam check couldn't load. Check your connection.");
              setStep("idle");
            }}
          />
        </div>
      ) : (
        links && (
          <div className="mt-4">
            <p aria-live="polite" className="text-sm text-muted-foreground">
              Open Telegram and press <span className="font-semibold text-foreground">Start</span>. This page signs in by
              itself once you do.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {links.links.gk && (
                <a href={links.links.gk} target="_blank" rel="noopener noreferrer" className={cn(btn.primary, "h-12 text-base")}>
                  <Send aria-hidden="true" className="size-[18px]" /> Open Telegram
                </a>
              )}
              {links.links.opp && (
                <a href={links.links.opp} target="_blank" rel="noopener noreferrer" className={cn(btn.outline, "h-12")}>
                  or use @opponentlagbebot
                </a>
              )}
            </div>
          </div>
        )
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-5 border-t pt-4">
        {withCode ? (
          <CodeSignIn />
        ) : (
          <button type="button" onClick={() => setWithCode(true)} className="link-draw text-sm font-semibold text-muted-foreground hover:text-foreground">
            No Telegram on this device? Sign in with a code
          </button>
        )}
      </div>
    </section>
  );
}

function CodeSignIn() {
  const [code, setCode] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !/^\d{6}$/.test(code)) return;
    setBusy(true);
    const result = await signInWithCode(code, token);
    setBusy(false);
    setToken(null); // a spam-check token works once
    if (result === "bad_code") setError("That code is wrong or expired. Send /login again for a new one.");
    else if (result === "failed") setError("Couldn't sign in. Check your connection and try again.");
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <p className="text-sm text-muted-foreground">
        On the phone that has Telegram, send <span className="font-semibold text-foreground">/login</span> to @gklagbebot
        or @opponentlagbebot. Type the 6-digit code it sends you:
      </p>
      <label htmlFor="signin-code" className="sr-only">
        Sign-in code
      </label>
      <input
        id="signin-code"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="123456"
        className="mt-3 w-40 rounded-xl border border-line bg-background px-4 py-3 text-center font-display text-2xl tracking-[0.3em] outline-none focus-visible:border-primary"
      />
      {!token && (
        <div className="mt-3">
          <Turnstile onToken={setToken} onError={() => setError("The spam check couldn't load. Check your connection.")} />
        </div>
      )}
      <button type="submit" disabled={!token || code.length !== 6 || busy} className={cn(btn.outline, "mt-3 disabled:opacity-60")}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
