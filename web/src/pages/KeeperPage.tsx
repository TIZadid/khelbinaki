import { X } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useState } from "react";
import { useKeeperProfile } from "@/hooks/useKeeperProfile";
import { formatPhone } from "@/lib/contact";
import {
  MAX_AREAS,
  type ProfileErrors,
  clearKeeperProfile,
  dedupeAreas,
  saveKeeperProfile,
  validateKeeperProfile,
} from "@/lib/keeper";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-lg border bg-background/60 px-4 py-3 text-base outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40 aria-[invalid=true]:border-destructive";
const labelStyle = "text-sm font-semibold";

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="mt-1.5 text-sm text-destructive">
      {message}
    </p>
  ) : null;
}

export function KeeperPage() {
  const saved = useKeeperProfile();
  const [name, setName] = useState(saved?.name ?? "");
  const [phone, setPhone] = useState(saved ? formatPhone(saved.phone) : "");
  const [areas, setAreas] = useState<string[]>(saved?.areas ?? []);
  const [areaDraft, setAreaDraft] = useState("");
  const [note, setNote] = useState(saved?.note ?? "");
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");

  const addArea = () => {
    setAreas(dedupeAreas([...areas, areaDraft]));
    setAreaDraft("");
  };

  const onAreaKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault(); // Enter adds the area instead of submitting the form.
    addArea();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const result = validateKeeperProfile({ name, phone, areas: [...areas, areaDraft], note });
    if (!result.ok) {
      setErrors(result.errors);
      setStatus("idle");
      return;
    }
    setErrors({});
    setAreas(result.value.areas);
    setAreaDraft("");
    setStatus(saveKeeperProfile(result.value) ? "saved" : "failed");
  };

  const onDelete = () => {
    clearKeeperProfile();
    setName("");
    setPhone("");
    setAreas([]);
    setAreaDraft("");
    setNote("");
    setErrors({});
    setStatus("idle");
  };

  return (
    <div className="mx-auto w-full max-w-xl px-5 pt-10 pb-20 md:px-10">
      <p className="eyebrow text-primary">For goalkeepers</p>
      <h1 className="mt-3.5 font-display text-6xl leading-[0.88] font-extrabold uppercase">Your keeper profile</h1>
      <p className="mt-3 text-muted-foreground">
        Save your details once. They stay on this phone and fill in "I'm interested" for you. A host only sees them
        when you send a request.
      </p>

      <div className="mt-8 rounded-3xl border border-[#242a1f] bg-card p-6 sm:p-8">
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-6">
          <div>
            <label htmlFor="keeper-name" className={labelStyle}>
              Your name
            </label>
            <input
              id="keeper-name"
              className={cn(field, "mt-2")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? "keeper-name-error" : undefined}
            />
            <FieldError id="keeper-name-error" message={errors.name} />
          </div>

          <div>
            <label htmlFor="keeper-phone" className={labelStyle}>
              WhatsApp number
            </label>
            <input
              id="keeper-phone"
              className={cn(field, "mt-2")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
              placeholder="01712-345678"
              aria-invalid={errors.phone ? true : undefined}
              aria-describedby={errors.phone ? "keeper-phone-error" : undefined}
            />
            <FieldError id="keeper-phone-error" message={errors.phone} />
          </div>

          <div>
            <label htmlFor="keeper-area" className={labelStyle}>
              Areas you play in
            </label>
            <p className="mt-1 text-sm text-muted-foreground">Up to {MAX_AREAS}. The feed opens on these.</p>
            <div className="mt-2 flex gap-2">
              <input
                id="keeper-area"
                className={field}
                value={areaDraft}
                onChange={(e) => setAreaDraft(e.target.value)}
                onKeyDown={onAreaKey}
                placeholder="e.g. Mirpur"
                aria-invalid={errors.areas ? true : undefined}
                aria-describedby={errors.areas ? "keeper-area-error" : undefined}
              />
              <button
                type="button"
                onClick={addArea}
                aria-label="Add area"
                className="shrink-0 rounded-lg border px-4 font-semibold hover:border-primary hover:text-primary"
              >
                Add
              </button>
            </div>
            <FieldError id="keeper-area-error" message={errors.areas} />
            {areas.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {areas.map((area) => (
                  <li key={area.toLowerCase()}>
                    <span className="inline-flex items-center gap-1 rounded-full border py-1 pr-1 pl-3 text-sm">
                      {area}
                      <button
                        type="button"
                        onClick={() => setAreas(areas.filter((a) => a !== area))}
                        aria-label={`Remove ${area}`}
                        className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                      >
                        <X aria-hidden="true" className="size-3.5" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label htmlFor="keeper-note" className={labelStyle}>
              About you (optional)
            </label>
            <textarea
              id="keeper-note"
              className={cn(field, "mt-2 min-h-24")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. 5 years in goal, free most evenings"
              aria-invalid={errors.note ? true : undefined}
              aria-describedby={errors.note ? "keeper-note-error" : undefined}
            />
            <FieldError id="keeper-note-error" message={errors.note} />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="submit"
              className="rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Save profile
            </button>
            {saved && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-full border px-6 py-3 font-semibold text-muted-foreground hover:border-destructive hover:text-destructive"
              >
                Delete profile
              </button>
            )}
          </div>

          {status === "saved" && (
            <p role="status" className="text-sm">
              Saved on this phone.{" "}
              <Link to="/" className="font-semibold text-primary underline-offset-4 hover:underline">
                See games in your areas
              </Link>
            </p>
          )}
          {status === "failed" && (
            <p role="status" className="text-sm text-destructive">
              Couldn't save. Your browser is blocking storage for this site.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
