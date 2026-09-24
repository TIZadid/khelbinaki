import { X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useKeeperProfile } from "@/hooks/useKeeperProfile";
import { formatPhone } from "@/lib/contact";
import { RegionSelect } from "@/components/RegionSelect";
import { regionName } from "@/lib/bd";
import {
  MAX_REGIONS,
  type ProfileErrors,
  clearKeeperProfile,
  dedupeRegions,
  saveKeeperProfile,
  validateKeeperProfile,
} from "@/lib/keeper";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-lg border bg-background/60 px-4 py-3 text-base outline-none focus-visible:border-board focus-visible:ring-2 focus-visible:ring-ring/40 aria-[invalid=true]:border-destructive";
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
  const [phone, setPhone] = useState(saved?.phone ? formatPhone(saved.phone) : "");
  const [regions, setRegions] = useState<string[]>(saved?.regions ?? []);
  const [regionDraft, setRegionDraft] = useState("");
  const [note, setNote] = useState(saved?.note ?? "");
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");

  const addRegion = (slug: string) => {
    if (!slug) return;
    setRegions(dedupeRegions([...regions, slug]).slice(0, MAX_REGIONS));
    setRegionDraft("");
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const result = validateKeeperProfile({ name, phone, regions: [...regions, regionDraft], note });
    if (!result.ok) {
      setErrors(result.errors);
      setStatus("idle");
      return;
    }
    setErrors({});
    setRegions(result.value.regions);
    setRegionDraft("");
    setStatus(saveKeeperProfile(result.value) ? "saved" : "failed");
  };

  const onDelete = () => {
    clearKeeperProfile();
    setName("");
    setPhone("");
    setRegions([]);
    setRegionDraft("");
    setNote("");
    setErrors({});
    setStatus("idle");
  };

  return (
    <div className="board-gk mx-auto w-full max-w-xl px-5 pt-10 pb-20 md:px-10">
      <p className="eyebrow text-board">GK Lagbe · for goalkeepers</p>
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
              WhatsApp number <span className="font-normal text-subtle">(optional)</span>
            </label>
            <p id="keeper-phone-hint" className="mt-1 text-sm text-muted-foreground">
              Some hosts keep their number private and ask keepers to send theirs instead. Save it here and we'll fill it
              in for those games. Only the host of a game you send it to sees it.
            </p>
            <input
              id="keeper-phone"
              className={cn(field, "mt-2")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
              placeholder="01712-345678"
              aria-invalid={errors.phone ? true : undefined}
              aria-describedby={errors.phone ? "keeper-phone-hint keeper-phone-error" : "keeper-phone-hint"}
            />
            <FieldError id="keeper-phone-error" message={errors.phone} />
          </div>

          <div>
            <label htmlFor="keeper-region" className={labelStyle}>
              Where do you play?
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick up to {MAX_REGIONS} districts, or a whole division. GK Lagbe opens on these.
            </p>
            <RegionSelect
              id="keeper-region"
              value={regionDraft}
              onChange={addRegion}
              includeDivisions
              placeholder="Add a district or division"
              className={cn(field, "mt-2")}
              invalid={Boolean(errors.regions)}
            />
            <FieldError id="keeper-region-error" message={errors.regions} />
            {regions.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {regions.map((slug) => (
                  <li key={slug}>
                    <span className="inline-flex items-center gap-1 rounded-full border border-board py-1 pr-1 pl-3 text-sm text-board">
                      {regionName(slug) ?? slug}
                      <button
                        type="button"
                        onClick={() => setRegions(regions.filter((r) => r !== slug))}
                        aria-label={`Remove ${regionName(slug) ?? slug}`}
                        className="rounded-full p-1 hover:text-foreground"
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
              className="rounded-full bg-board px-6 py-3 font-semibold text-board-foreground hover:bg-board/90"
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
              <Link to="/#gk-lagbe" className="font-semibold text-board underline-offset-4 hover:underline">
                See GK Lagbe in your places
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

      <section aria-labelledby="alerts-link-heading" className="mt-10 rounded-3xl border border-[#242a1f] bg-card p-5 md:p-7">
        <h2 id="alerts-link-heading" className="font-display text-[34px] leading-none font-extrabold uppercase">
          Get alerts
        </h2>
        <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">
          Hear the moment a game near you needs a keeper — on this device or on Telegram. Free, and you can stop any time.
        </p>
        <Link to="/alerts?board=gk" className="mt-4 inline-flex h-11 items-center rounded-full border border-board px-5 text-sm font-semibold text-board hover:bg-board hover:text-board-foreground">
          Set up alerts
        </Link>
      </section>
    </div>
  );
}
