import { type FormEvent, useState } from "react";
import { RegionSelect } from "@/components/RegionSelect";
import { Turnstile } from "@/components/Turnstile";
import { type ContactMode, createPost } from "@/lib/api";
import { managePath, rememberMyPost } from "@/lib/myPosts";
import { normalizeBdPhone } from "@/lib/phone";
import { navigate } from "@/lib/router";
import { btn } from "@/lib/ui";
import { cn } from "@/lib/utils";

const field =
  "mt-2 w-full rounded-xl border border-line bg-card px-4 py-3 text-base outline-none focus-visible:border-primary aria-[invalid=true]:border-destructive";
const legend = "eyebrow float-left pb-3";

// Bangladesh is UTC+6 all year, so a local date + time maps straight onto an ISO string.
const DHAKA_OFFSET = "+06:00";

function dhakaToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function NewPostPage() {
  const [values, setValues] = useState({
    district: "",
    area: "",
    turf_name: "",
    date: dhakaToday(),
    time: "20:00",
    duration: 60,
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

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!values.host_name.trim()) next.host_name = "Tell keepers your name";
    if (!values.district) next.district = "Choose a district";
    if (!values.area.trim()) next.area = "Which part of town?";
    const phone = normalizeBdPhone(values.phone);
    if (!phone) next.phone = "Enter a Bangladeshi mobile number like 01712345678";
    const start = new Date(`${values.date}T${values.time}:00${DHAKA_OFFSET}`);
    if (Number.isNaN(start.getTime())) next.date = "Pick a date and time";
    else if (start.getTime() <= Date.now()) next.date = "Pick a time in the future";
    const cost = values.cost.trim() === "" ? undefined : Number(values.cost);
    if (cost !== undefined && (!Number.isInteger(cost) || cost < 0 || cost > 10000)) next.cost = "Whole taka, 0 to 10000";
    setErrors(next);
    if (Object.keys(next).length > 0 || !token) return;

    setStatus("sending");
    const result = await createPost({
      host_name: values.host_name.trim(),
      phone: phone as string,
      area: values.area.trim(),
      district: values.district,
      turf_name: values.turf_name.trim() || undefined,
      start_datetime: start.toISOString(),
      duration_minutes: values.duration,
      cost_per_head: cost,
      slots_needed: values.slots,
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

  const err = (key: string) => errors[key] && <p className="mt-1.5 text-sm text-destructive">{errors[key]}</p>;

  return (
    <div className="mx-auto w-full max-w-xl px-5 pt-10 pb-20 md:px-10">
      <p className="eyebrow text-primary">For hosts · no sign-up</p>
      <h1 className="mt-3.5 font-display text-6xl leading-[0.88] font-extrabold uppercase">Post a match</h1>

      <form noValidate onSubmit={onSubmit} className="mt-8 flex flex-col gap-7">
        <fieldset className="flex flex-col gap-4 border-0 p-0">
          <legend className={legend}>The game</legend>
          <div className="clear-both">
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
            <input id="f-turf" value={values.turf_name} onChange={(e) => set({ turf_name: e.target.value })} className={field} />
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
                  className={cn(
                    "h-11 flex-1 rounded-full border text-sm font-medium transition-colors",
                    values.duration === minutes ? "border-foreground text-foreground" : "border-[#242a1f] text-muted-foreground",
                  )}
                >
                  {minutes} min
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 items-end gap-3">
            <div>
              <label htmlFor="f-cost" className="text-sm font-semibold">
                Cost per head <span className="font-normal text-subtle">(৳)</span>
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
            <div>
              <span id="f-slots" className="text-sm font-semibold">
                Keepers needed
              </span>
              <div role="group" aria-labelledby="f-slots" className="mt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  aria-label="Fewer keepers"
                  onClick={() => set({ slots: Math.max(1, values.slots - 1) })}
                  className={btn.icon}
                >
                  −
                </button>
                <span className="font-display text-[32px] leading-none font-bold">{values.slots}</span>
                <button
                  type="button"
                  aria-label="More keepers"
                  onClick={() => set({ slots: Math.min(5, values.slots + 1) })}
                  className={btn.icon}
                >
                  +
                </button>
              </div>
            </div>
          </div>
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
              placeholder="e.g. Friendly, mixed level. Pitch 3."
              className={cn(field, "min-h-22 resize-none")}
            />
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-4 border-0 border-t border-border p-0 pt-7">
          <legend className={legend}>You</legend>
          <div className="clear-both">
            <label htmlFor="f-name" className="text-sm font-semibold">
              Your name
            </label>
            <input
              id="f-name"
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
        </fieldset>

        <fieldset className="flex flex-col gap-3 border-0 border-t border-border p-0 pt-7">
          <legend className={legend}>How should keepers reach you?</legend>
          {(
            [
              ["direct", "Keepers message me", "They tap Contact host and get your number. Fastest for games tonight."],
              ["requests", "Keepers send me their number", "Your number stays private. Check this post's page and pick who to WhatsApp."],
            ] as const
          ).map(([value, title, body]) => (
            <label
              key={value}
              className={cn(
                "clear-both flex gap-3.5 rounded-2xl border bg-card p-4.5 transition-colors",
                mode === value ? "border-primary" : "border-[#242a1f]",
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
        </fieldset>

        <Turnstile
          onToken={setToken}
          onError={() => {
            setToken(null);
            setStatus("error");
            setMessage("The spam check couldn't load. Check your connection.");
          }}
        />

        <button type="submit" disabled={!token || status === "sending"} className={cn(btn.primary, "disabled:opacity-60")}>
          {!token ? "Checking you're human…" : status === "sending" ? "Posting…" : "Post match"}
        </button>

        {status === "error" && (
          <p role="alert" className="text-sm text-destructive">
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
