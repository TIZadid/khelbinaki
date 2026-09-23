import { motion } from "motion/react";
import { type FormEvent, type ReactNode, useState } from "react";
import { RegionSelect } from "@/components/RegionSelect";
import { Turnstile } from "@/components/Turnstile";
import { RevealWords } from "@/components/motion/RevealWords";
import { type ContactMode, createPost } from "@/lib/api";
import { districtName } from "@/lib/bd";
import { FORMATS, LISTINGS, type ListingType, formatLabel } from "@/lib/listing";
import { managePath, rememberMyPost } from "@/lib/myPosts";
import { normalizeBdPhone } from "@/lib/phone";
import { Link, navigate } from "@/lib/router";
import { formatDay, formatTime } from "@/lib/time";
import { btn } from "@/lib/ui";
import { cn } from "@/lib/utils";

const field =
  "mt-2 w-full rounded-xl border border-line bg-card/80 px-4 py-3 text-base outline-none transition-[border-color,box-shadow] duration-150 hover:border-[#3a4233] focus-visible:border-primary focus-visible:shadow-[0_0_0_4px_rgb(166_212_33/0.12)] aria-[invalid=true]:border-destructive";
const choice = (active: boolean) =>
  cn(
    "h-11 flex-1 rounded-full border text-sm font-medium transition-[border-color,color,background-color,transform] duration-150 active:scale-[0.97]",
    active ? "border-foreground bg-foreground text-background" : "border-[#242a1f] text-muted-foreground hover:border-line hover:text-foreground",
  );

// Bangladesh is UTC+6 all year, so a local date + time maps straight onto an ISO string.
const DHAKA_OFFSET = "+06:00";

function dhakaToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

const CONTACT_CHOICES: Record<ListingType, [ContactMode, string, string][]> = {
  gk_needed: [
    ["direct", "Keepers message me", "They tap Contact host and get your number. Fastest when kick-off is close."],
    ["requests", "Keepers send me their number", "Your number stays private. Check this post's page and pick who to WhatsApp."],
  ],
  opponent_needed: [
    ["direct", "Teams message me", "They tap Contact team and get your number. Fastest when kick-off is close."],
    ["requests", "Teams send me their number", "Your number stays private. Check this post's page and pick which team to WhatsApp."],
  ],
};

function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 border-0 border-t border-border p-0 pt-7 first:border-t-0 first:pt-0">
      <legend className="float-left flex items-baseline gap-3 pb-3">
        <span className="font-display text-lg font-bold text-primary">{n}</span>
        <span className="eyebrow">{title}</span>
      </legend>
      <div className="clear-both flex flex-col gap-4">{children}</div>
    </fieldset>
  );
}

export function NewPostPage({ type = "gk_needed" }: { type?: ListingType }) {
  const copy = LISTINGS[type];
  const opponent = type === "opponent_needed";
  const [values, setValues] = useState({
    team_name: "",
    district: "",
    area: "",
    turf_name: "",
    date: dhakaToday(),
    time: "20:00",
    format: 5,
    duration: opponent ? 90 : 60,
    cost: "",
    slots: 1,
    notes: "",
    host_name: "",
    phone: "",
  });
  const [mode, setMode] = useState<ContactMode>("direct");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [message, setMessage] = useState("");

  const set = (patch: Partial<typeof values>) => setValues((v) => ({ ...v, ...patch }));
  const start = new Date(`${values.date}T${values.time}:00${DHAKA_OFFSET}`);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (opponent && !values.team_name.trim()) next.team_name = "What's your team called?";
    if (!values.host_name.trim()) next.host_name = opponent ? "Who should teams ask for?" : "Tell keepers your name";
    if (!values.district) next.district = "Choose a district";
    if (!values.area.trim()) next.area = "Which part of town?";
    const phone = normalizeBdPhone(values.phone);
    if (!phone) next.phone = "Enter a Bangladeshi mobile number like 01712345678";
    if (Number.isNaN(start.getTime())) next.date = "Pick a date and time";
    else if (start.getTime() <= Date.now()) next.date = "Pick a time in the future";
    const cost = values.cost.trim() === "" ? undefined : Number(values.cost);
    if (cost !== undefined && (!Number.isInteger(cost) || cost < 0 || cost > 10000)) next.cost = "Whole taka, 0 to 10000";
    setErrors(next);
    if (Object.keys(next).length > 0) {
      document.getElementById(`f-${Object.keys(next)[0].replace("_", "-")}`)?.focus();
      return;
    }
    if (!token) return;

    setStatus("sending");
    const result = await createPost({
      listing_type: type,
      team_name: opponent ? values.team_name.trim() : undefined,
      players_per_side: values.format,
      host_name: values.host_name.trim(),
      phone: phone as string,
      area: values.area.trim(),
      district: values.district,
      turf_name: values.turf_name.trim() || undefined,
      start_datetime: start.toISOString(),
      duration_minutes: values.duration,
      cost_per_head: cost,
      slots_needed: opponent ? 1 : values.slots,
      notes: values.notes.trim() || undefined,
      contact_mode: mode,
      turnstile_token: token,
    });

    if (result.ok) {
      rememberMyPost({ id: result.post.id, token: result.editToken });
      navigate(managePath(result.post.id, result.editToken));
      return;
    }
    setStatus("error");
    setToken(null);
    if (result.failure.fields) setErrors(result.failure.fields);
    setMessage(
      result.failure.error === "captcha_failed"
        ? "The spam check didn't pass. Try again."
        : "Couldn't post that. Check the fields and try again.",
    );
  };

  const err = (key: string) =>
    errors[key] && (
      <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-1.5 text-sm text-destructive">
        {errors[key]}
      </motion.p>
    );

  return (
    <div className="page-x pt-10 pb-24 md:pt-16">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,36rem)_minmax(0,1fr)] lg:gap-20">
        <div>
          {/* Two separate boards, two separate forms: this just hops between them. */}
          <nav aria-label="What do you need?" className="inline-flex rounded-full border border-[#242a1f] p-1">
            {(["gk_needed", "opponent_needed"] as const).map((t) => (
              <Link
                key={t}
                to={LISTINGS[t].newPath}
                aria-current={t === type ? "page" : undefined}
                className={cn(
                  "relative isolate rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                  t === type ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t === type && (
                  <motion.span layoutId="post-type" className="absolute inset-0 -z-10 rounded-full bg-primary" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                )}
                {LISTINGS[t].board}
              </Link>
            ))}
          </nav>

          <p className="eyebrow mt-8 text-primary">{opponent ? "For teams" : "For hosts"} · free · no sign-up</p>
          <h1 aria-label={copy.postCta} className="mt-3.5 font-display text-[64px] leading-[0.86] font-extrabold uppercase md:text-[88px]">
            <RevealWords text={copy.postCta} />
          </h1>
          <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground">
            {opponent
              ? "Got the turf, need a team to play? Post your match and teams near you will see it on Opponent Lagbe."
              : "Short a goalkeeper? Post your match and keepers near you will see it on GK Lagbe."}
          </p>

          <form noValidate onSubmit={onSubmit} className="mt-10 flex flex-col gap-8">
            {opponent && (
              <Section n="01" title="Your team">
                <div>
                  <label htmlFor="f-team-name" className="text-sm font-semibold">
                    Team name
                  </label>
                  <input
                    id="f-team-name"
                    value={values.team_name}
                    onChange={(e) => set({ team_name: e.target.value })}
                    placeholder="e.g. FC Mirpur 10"
                    maxLength={60}
                    className={field}
                    aria-invalid={errors.team_name ? true : undefined}
                  />
                  {err("team_name")}
                </div>
              </Section>
            )}

            <Section n={opponent ? "02" : "01"} title="The match">
              <div>
                <span id="f-format-label" className="text-sm font-semibold">
                  How many a side?
                </span>
                <div role="group" aria-labelledby="f-format-label" className="mt-2 flex gap-2">
                  {FORMATS.map((n) => (
                    <button key={n} type="button" aria-pressed={values.format === n} onClick={() => set({ format: n })} className={choice(values.format === n)}>
                      {n}
                      <span className="sr-only">-a-side</span>
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[13px] text-subtle">Players per team, including the keeper.</p>
                {err("players_per_side")}
              </div>
              <div>
                <label htmlFor="f-district" className="text-sm font-semibold">
                  District
                </label>
                <RegionSelect
                  id="f-district"
                  value={values.district}
                  onChange={(district) => set({ district })}
                  className={field}
                  invalid={Boolean(errors.district)}
                />
                {err("district")}
              </div>
              <div className="grid gap-4 sm:grid-cols-2 sm:gap-3">
                <div>
                  <label htmlFor="f-area" className="text-sm font-semibold">
                    Area
                  </label>
                  <input
                    id="f-area"
                    value={values.area}
                    onChange={(e) => set({ area: e.target.value })}
                    placeholder="e.g. Mirpur 10"
                    className={field}
                    aria-invalid={errors.area ? true : undefined}
                  />
                  {err("area")}
                </div>
                <div>
                  <label htmlFor="f-turf" className="text-sm font-semibold">
                    Turf <span className="font-normal text-subtle">(optional)</span>
                  </label>
                  <input id="f-turf" value={values.turf_name} onChange={(e) => set({ turf_name: e.target.value })} placeholder="e.g. Kings Arena" className={field} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="f-date" className="text-sm font-semibold">
                    Date
                  </label>
                  <input
                    id="f-date"
                    type="date"
                    value={values.date}
                    onChange={(e) => set({ date: e.target.value })}
                    className={field}
                    aria-invalid={errors.date ? true : undefined}
                  />
                </div>
                <div>
                  <label htmlFor="f-time" className="text-sm font-semibold">
                    Kick-off
                  </label>
                  <input id="f-time" type="time" value={values.time} onChange={(e) => set({ time: e.target.value })} className={field} />
                </div>
              </div>
              {err("date")}
              {err("start_datetime")}
              <div>
                <span id="f-duration" className="text-sm font-semibold">
                  Length
                </span>
                <div role="group" aria-labelledby="f-duration" className="mt-2 flex gap-2">
                  {[60, 90, 120].map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      aria-pressed={values.duration === minutes}
                      onClick={() => set({ duration: minutes })}
                      className={choice(values.duration === minutes)}
                    >
                      {minutes} min
                    </button>
                  ))}
                </div>
              </div>
              <div className={cn("grid items-end gap-3", !opponent && "grid-cols-2")}>
                <div>
                  <label htmlFor="f-cost" className="text-sm font-semibold">
                    {copy.costLabel} <span className="font-normal text-subtle">(৳)</span>
                  </label>
                  <input
                    id="f-cost"
                    inputMode="numeric"
                    value={values.cost}
                    onChange={(e) => set({ cost: e.target.value })}
                    placeholder="Leave blank to ask"
                    className={field}
                    aria-invalid={errors.cost ? true : undefined}
                  />
                </div>
                {!opponent && (
                  <div>
                    <span id="f-slots" className="text-sm font-semibold">
                      Keepers needed
                    </span>
                    <div role="group" aria-labelledby="f-slots" className="mt-2 flex items-center justify-between gap-2">
                      <button type="button" aria-label="Fewer keepers" onClick={() => set({ slots: Math.max(1, values.slots - 1) })} className={btn.icon}>
                        −
                      </button>
                      <span className="font-display text-[32px] leading-none font-bold">{values.slots}</span>
                      <button type="button" aria-label="More keepers" onClick={() => set({ slots: Math.min(5, values.slots + 1) })} className={btn.icon}>
                        +
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <p className="-mt-2 text-[13px] text-subtle">{copy.costHint}.</p>
              {err("cost")}
              {err("cost_per_head")}
              <div>
                <label htmlFor="f-notes" className="text-sm font-semibold">
                  Notes <span className="font-normal text-subtle">(optional)</span>
                </label>
                <textarea
                  id="f-notes"
                  value={values.notes}
                  onChange={(e) => set({ notes: e.target.value })}
                  placeholder={opponent ? "e.g. Mid-level, friendly. We split the turf half and half." : "e.g. Friendly, mixed level. Pitch 3."}
                  className={cn(field, "min-h-22 resize-none")}
                />
              </div>
            </Section>

            <Section n={opponent ? "03" : "02"} title="You">
              <div>
                <label htmlFor="f-host-name" className="text-sm font-semibold">
                  {opponent ? "Your name (captain or organiser)" : "Your name"}
                </label>
                <input
                  id="f-host-name"
                  value={values.host_name}
                  onChange={(e) => set({ host_name: e.target.value })}
                  autoComplete="name"
                  className={field}
                  aria-invalid={errors.host_name ? true : undefined}
                />
                {err("host_name")}
              </div>
              <div>
                <label htmlFor="f-phone" className="text-sm font-semibold">
                  WhatsApp number
                </label>
                <input
                  id="f-phone"
                  value={values.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="01712-345678"
                  className={field}
                  aria-invalid={errors.phone ? true : undefined}
                />
                <p className="mt-1.5 text-[13px] text-subtle">Never shown on the site.</p>
                {err("phone")}
              </div>
            </Section>

            <Section n={opponent ? "04" : "03"} title={opponent ? "How should teams reach you?" : "How should keepers reach you?"}>
              {CONTACT_CHOICES[type].map(([value, title, body]) => (
                <label
                  key={value}
                  className={cn(
                    "flex cursor-pointer gap-3.5 rounded-2xl border bg-card/80 p-4.5 transition-colors duration-150",
                    mode === value ? "border-primary" : "border-[#242a1f] hover:border-line",
                  )}
                >
                  <input
                    type="radio"
                    name="contact_mode"
                    value={value}
                    checked={mode === value}
                    onChange={() => setMode(value)}
                    className="mt-1 size-5 accent-primary"
                  />
                  <span>
                    <span className="block font-semibold">{title}</span>
                    <span className="mt-1 block text-sm leading-snug text-muted-foreground">{body}</span>
                  </span>
                </label>
              ))}
            </Section>

            <Turnstile
              onToken={setToken}
              onError={() => {
                setToken(null);
                setStatus("error");
                setMessage("The spam check couldn't load. Check your connection.");
              }}
            />

            <button type="submit" disabled={!token || status === "sending"} className={cn(btn.primary, "disabled:opacity-60")}>
              {!token ? "Checking you're human…" : status === "sending" ? "Posting…" : `Post to ${copy.board}`}
            </button>

            {status === "error" && (
              <p role="alert" className="text-sm text-destructive">
                {message}
              </p>
            )}
          </form>
        </div>

        <aside aria-label="Preview" className="hidden lg:block">
          <div className="sticky top-28">
            <p className="eyebrow">How it'll look on {copy.board}</p>
            <Preview type={type} values={values} start={start} mode={mode} />
            <p className="mt-4 text-[13px] leading-relaxed text-subtle">
              Your number never shows. {opponent ? "Teams" : "Keepers"} reach you the way you choose below the form.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** A live card that redraws as the host types, so they see what players will see. */
function Preview({
  type,
  values,
  start,
  mode,
}: {
  type: ListingType;
  values: { team_name: string; area: string; turf_name: string; district: string; format: number; duration: number; cost: string; slots: number; host_name: string };
  start: Date;
  mode: ContactMode;
}) {
  const copy = LISTINGS[type];
  const opponent = type === "opponent_needed";
  const valid = !Number.isNaN(start.getTime());
  const title = opponent ? values.team_name.trim() || "Your team" : values.area.trim() || "Your area";
  const place = [opponent ? values.area.trim() : null, values.turf_name.trim(), districtName(values.district)].filter(Boolean).join(" · ");
  const bits = [formatLabel(values.format), `${values.duration} min`, !opponent && values.slots > 1 ? `${values.slots} keepers` : null].filter(Boolean);

  return (
    <motion.div layout className="mt-4 overflow-hidden rounded-3xl border border-[#242a1f] bg-card/90 backdrop-blur">
      <div className="flex items-end justify-between gap-4 p-6">
        <div className="min-w-0">
          <p className="eyebrow text-subtle">{valid ? formatDay(start) : "Pick a date"}</p>
          <p className="mt-2 font-display text-[64px] leading-none font-bold text-primary">{valid ? formatTime(start) : "--:--"}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-4xl leading-none font-bold">{values.cost.trim() ? `৳${values.cost.trim()}` : "Ask"}</p>
          {values.cost.trim() && <p className="mt-1 text-sm text-subtle">{copy.costUnit}</p>}
        </div>
      </div>
      <div className="border-t border-dashed border-line p-6">
        <p className="flex items-center gap-3 text-xl font-semibold break-words">
          {title}
          {opponent && <span className="font-display text-lg font-bold text-subtle uppercase">vs ?</span>}
        </p>
        <p className="mt-1 text-[15px] text-subtle">{place || "District and turf"}</p>
        <p className="mt-4 flex flex-wrap gap-2">
          {bits.map((bit) => (
            <span key={bit} className="rounded-full border border-line px-3 py-1 text-xs font-semibold tracking-[0.08em] uppercase">
              {bit}
            </span>
          ))}
        </p>
        <span className={cn(btn.outline, "pointer-events-none mt-6 w-full")}>
          {mode === "direct" ? copy.directAction : copy.requestAction}
        </span>
      </div>
    </motion.div>
  );
}
