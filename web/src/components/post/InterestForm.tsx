import { Lock } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Turnstile } from "@/components/Turnstile";
import { useKeeperProfile } from "@/hooks/useKeeperProfile";
import { type PublicPost, sendInterest } from "@/lib/api";
import { formatPhone } from "@/lib/contact";
import { isOpponent, listingOf } from "@/lib/listing";
import { normalizeBdPhone } from "@/lib/phone";
import { Link } from "@/lib/router";
import { btn } from "@/lib/ui";
import { cn } from "@/lib/utils";

const field =
  "mt-2 w-full rounded-xl border border-line bg-background px-4 py-3 text-base outline-none focus-visible:border-primary aria-[invalid=true]:border-destructive";

const messages = (opponent: boolean): Record<string, string> => ({
  closed: opponent ? "This team has already found an opponent." : "This game is no longer taking keepers.",
  not_found: "This post was removed.",
  full: opponent ? "This team already has plenty of offers." : "This game already has plenty of keepers interested.",
  captcha_failed: "The spam check didn't pass. Try again.",
});

// Requests posts: the keeper (or a team) leaves their details; only the host sees them.
export function InterestForm({ post }: { post: PublicPost }) {
  const opponent = isOpponent(post);
  const copy = listingOf(post);
  // The keeper profile is a keeper's details, so it only fills in keeper games.
  const profile = useKeeperProfile();
  const keeper = opponent ? null : profile;
  const [name, setName] = useState(keeper?.name ?? "");
  const [phone, setPhone] = useState(keeper ? formatPhone(keeper.phone) : "");
  const [note, setNote] = useState(keeper?.note ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  if (status === "sent") {
    return (
      <section aria-labelledby="sent-heading" className="mt-9 rounded-3xl border border-primary/40 bg-card p-6 md:p-7">
        <h2 id="sent-heading" className="font-display text-[34px] leading-none font-extrabold uppercase">
          Sent to {post.host_name}
        </h2>
        <p role="status" className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          {opponent
            ? "They'll WhatsApp you to fix the match. Nothing else to do — your number stays with them."
            : "They'll WhatsApp you if you're picked. Nothing else to do — your number stays with them."}
        </p>
        <Link to={`/#${copy.anchor}`} className="link-draw mt-5 inline-block font-semibold text-primary">
          Back to {copy.board}
        </Link>
      </section>
    );
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = opponent ? "Tell them your team's name" : "Tell the host your name";
    const normalized = normalizeBdPhone(phone);
    if (!normalized) nextErrors.phone = "Enter a Bangladeshi mobile number like 01712345678";
    if (note.trim().length > 200) nextErrors.note = "At most 200 characters";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (!token) return;

    setStatus("sending");
    const result = await sendInterest(post.id, {
      name: name.trim(),
      phone: normalized as string,
      note: note.trim(),
      turnstile_token: token,
    });
    if (result.ok) {
      setStatus("sent");
      return;
    }
    setStatus("error");
    setToken(null);
    if (result.failure.fields) setErrors(result.failure.fields);
    setMessage(messages(opponent)[result.failure.error] ?? "Couldn't send that. Try again.");
  };

  return (
    <section aria-labelledby="interest-heading" className="mt-9 rounded-3xl border border-[#242a1f] bg-card p-5 md:p-7">
      <h2 id="interest-heading" className="font-display text-[34px] leading-none font-extrabold uppercase">
        {copy.requestAction}
      </h2>
      <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">
        {opponent
          ? `${post.team_name ?? post.host_name} keeps their number private. Send your team's details and they'll WhatsApp you to fix the match.`
          : `${post.host_name} keeps their number private. Send yours and they'll WhatsApp you if you're picked.`}
      </p>

      {keeper && (
        <p className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-muted px-3.5 py-2.5 text-[13px] text-muted-foreground">
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="size-[7px] rounded-full bg-primary" />
            Filled in from your keeper profile
          </span>
          <Link to="/keeper" className="font-semibold text-primary">
            Edit
          </Link>
        </p>
      )}

      <form noValidate onSubmit={onSubmit} className="mt-5 flex flex-col gap-4">
        <div>
          <label htmlFor="i-name" className="text-sm font-semibold">
            {opponent ? "Your team" : "Your name"}
          </label>
          <input
            id="i-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete={opponent ? "off" : "name"}
            placeholder={opponent ? "e.g. Dhanmondi Dynamos" : undefined}
            className={field}
            aria-invalid={errors.name ? true : undefined}
          />
          {errors.name && <p className="mt-1.5 text-sm text-destructive">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="i-phone" className="text-sm font-semibold">
            WhatsApp number
          </label>
          <input
            id="i-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            autoComplete="tel"
            placeholder="01712-345678"
            className={field}
            aria-invalid={errors.phone ? true : undefined}
          />
          {errors.phone && <p className="mt-1.5 text-sm text-destructive">{errors.phone}</p>}
        </div>
        <div>
          <label htmlFor="i-note" className="text-sm font-semibold">
            Note for {post.host_name} <span className="font-normal text-subtle">(optional)</span>
          </label>
          <textarea
            id="i-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={opponent ? "e.g. Captain Sakib. Mid-level side, can do 8 PM." : "e.g. 5 years in goal, free most evenings"}
            className={cn(field, "min-h-22 resize-none")}
            aria-invalid={errors.note ? true : undefined}
          />
          {errors.note && <p className="mt-1.5 text-sm text-destructive">{errors.note}</p>}
        </div>

        <Turnstile
          onToken={setToken}
          onError={() => {
            setToken(null);
            setStatus("error");
            setMessage("The spam check couldn't load. Check your connection.");
          }}
        />

        <button
          type="submit"
          disabled={!token || status === "sending"}
          className={cn(btn.primary, "disabled:opacity-60")}
        >
          {!token ? "Checking you're human…" : status === "sending" ? "Sending…" : `Send to ${post.host_name}`}
        </button>

        {status === "error" && (
          <p role="alert" className="text-sm text-destructive">
            {message}
          </p>
        )}

        <p className="flex gap-2 text-[13px] leading-relaxed text-subtle">
          <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Only {post.host_name} sees your number.
        </p>
      </form>
    </section>
  );
}
