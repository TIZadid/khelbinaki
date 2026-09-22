# Feature 4b: Keeper Profile (on-device) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keepers get their own onboarding: an "I'm a keeper" page where they save their name, WhatsApp number, areas and a short note on their phone, after which the feed opens on games in their areas and (in 4c) "I'm interested" fills itself in.

**Architecture:** Pure web feature, no API or account. `lib/keeper.ts` validates the profile and keeps it in `localStorage` behind a tiny store (load/save/clear/subscribe, change event); `useKeeperProfile` reads it with `useSyncExternalStore`. A `/keeper` page edits it; the header links to it; the feed adds a "My areas" chip and selects it by default when the keeper's areas have games.

**Tech Stack:** React 19, Tailwind v4, Vitest + Testing Library (jsdom `localStorage`).

**Spec:** `CLAUDE.md` + `docs/superpowers/specs/2026-09-21-khelbinaki-design.md` (§8 roadmap, §9 contact modes). Decision (owner, 2026-09-22): keeper onboarding = "Keeper profile, saved on phone" only (no public keeper list, no alerts, no first-visit guide).

## Global Constraints

- No accounts and no server storage: the profile lives only in this browser's `localStorage` (key `khelbinaki.keeper.v1`). It leaves the phone only when the keeper sends an "I'm interested" request (4c).
- Storage may be unavailable or throw (private mode, blocked site data): the site must work without it and say so when saving fails.
- Phone rule identical to the API: Bangladeshi mobile `01[3-9]` + 8 digits, optional `88`, stored as `8801XXXXXXXXX`.
- Limits: name 1–60, up to 5 areas (each ≤40, deduped case-insensitively), note ≤200 — matching the API's interest limits (name 60, note 200).
- Keep the current visual system (dark + lime tokens, Barlow Condensed numerals); the full redesign sync happens after 4d.
- Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## File Map

```
web/src/lib/phone.ts                      normalizeBdPhone (same rule as the API)
web/src/lib/keeper.ts + keeper.test.ts    KeeperProfile, validateKeeperProfile, dedupeAreas, store functions
web/src/hooks/useKeeperProfile.ts         useSyncExternalStore over the store
web/src/pages/KeeperPage.tsx + .test.tsx  /keeper form
web/src/components/feed/AreaChips.tsx     + MY_AREAS_KEY chip
web/src/components/feed/Feed.tsx          default to "My areas"
web/src/components/feed/Feed.test.tsx     + profile cases
web/src/components/AppShell.tsx           header link "I'm a keeper" / "My profile"
web/src/pages/HomePage.tsx                hero link "I'm a keeper"
web/src/App.tsx + App.test.tsx            /keeper route
web/src/test/setup.ts                     clear localStorage after each test
```

---

### Task 1: Profile model and on-device store

**Interfaces:**
- Produces: `normalizeBdPhone(raw: string): string | null`; `type KeeperProfile = { name: string; phone: string; areas: string[]; note: string }`; `type ProfileErrors = Partial<Record<"name" | "phone" | "areas" | "note", string>>`; `MAX_AREAS = 5`; `dedupeAreas(areas: string[]): string[]`; `validateKeeperProfile(input: { name: string; phone: string; areas: string[]; note: string }): { ok: true; value: KeeperProfile } | { ok: false; errors: ProfileErrors }`; `readKeeperRaw(): string | null`; `parseKeeperProfile(raw: string | null): KeeperProfile | null`; `loadKeeperProfile(): KeeperProfile | null`; `saveKeeperProfile(p: KeeperProfile): boolean`; `clearKeeperProfile(): void`; `subscribeKeeperProfile(onChange: () => void): () => void`; `useKeeperProfile(): KeeperProfile | null`.

- [ ] **Step 1: Clear storage between tests** — append to `web/src/test/setup.ts`:

```ts
// Keeper profiles live in localStorage; start every test without one.
afterEach(() => window.localStorage.clear());
```

- [ ] **Step 2: Write failing tests `web/src/lib/keeper.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import {
  clearKeeperProfile,
  dedupeAreas,
  loadKeeperProfile,
  saveKeeperProfile,
  subscribeKeeperProfile,
  validateKeeperProfile,
} from "./keeper";

const input = { name: " Mehedi ", phone: "019 1234 5678", areas: ["Mirpur", " mirpur ", "", "Uttara"], note: " 5 yrs in goal " };

describe("validateKeeperProfile", () => {
  it("trims, normalises the phone and dedupes areas", () => {
    expect(validateKeeperProfile(input)).toEqual({
      ok: true,
      value: { name: "Mehedi", phone: "8801912345678", areas: ["Mirpur", "Uttara"], note: "5 yrs in goal" },
    });
  });

  it("reports each bad field", () => {
    const r = validateKeeperProfile({
      name: "  ",
      phone: "123",
      areas: ["A", "B", "C", "D", "E", "F"],
      note: "x".repeat(201),
    });
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(["areas", "name", "note", "phone"]);
  });
});

describe("dedupeAreas", () => {
  it("keeps the first spelling and drops blanks", () => {
    expect(dedupeAreas(["Mirpur", "MIRPUR", " ", "Agrabad "])).toEqual(["Mirpur", "Agrabad"]);
  });
});

describe("on-device store", () => {
  const profile = { name: "Mehedi", phone: "8801912345678", areas: ["Mirpur"], note: "" };

  it("saves, loads and clears", () => {
    expect(loadKeeperProfile()).toBeNull();
    expect(saveKeeperProfile(profile)).toBe(true);
    expect(loadKeeperProfile()).toEqual(profile);
    clearKeeperProfile();
    expect(loadKeeperProfile()).toBeNull();
  });

  it("ignores corrupt or foreign data", () => {
    window.localStorage.setItem("khelbinaki.keeper.v1", "{");
    expect(loadKeeperProfile()).toBeNull();
    window.localStorage.setItem("khelbinaki.keeper.v1", JSON.stringify({ name: 1 }));
    expect(loadKeeperProfile()).toBeNull();
  });

  it("notifies subscribers on save and clear", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeKeeperProfile(onChange);
    saveKeeperProfile(profile);
    clearKeeperProfile();
    unsubscribe();
    saveKeeperProfile(profile);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("reports failure when storage throws", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(saveKeeperProfile(profile)).toBe(false);
    setItem.mockRestore();
  });
});
```

- [ ] **Step 3: Run to verify it fails** — `cd web && npm test` → `./keeper` not found.

- [ ] **Step 4: Implement**

`web/src/lib/phone.ts`:

```ts
// Bangladeshi mobile: 01[3-9] + 8 digits, optional 88 country code. Same rule as the API
// (api/src/posts/validate.ts); stored as 8801XXXXXXXXX for wa.me.
export function normalizeBdPhone(raw: string): string | null {
  const match = /^(?:88)?(01[3-9]\d{8})$/.exec(raw.replace(/\D/g, ""));
  return match ? `88${match[1]}` : null;
}
```

`web/src/lib/keeper.ts`:

```ts
import { normalizeBdPhone } from "./phone";

// A keeper's details, kept only in this browser. Sent to a host only with an "I'm interested" request.
export type KeeperProfile = { name: string; phone: string; areas: string[]; note: string };
export type ProfileErrors = Partial<Record<"name" | "phone" | "areas" | "note", string>>;

export const MAX_AREAS = 5;
const STORAGE_KEY = "khelbinaki.keeper.v1";
const CHANGE_EVENT = "khelbinaki:keeper-profile";

// Trimmed, blank-free, unique ignoring case; the first spelling wins.
export function dedupeAreas(areas: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of areas) {
    const area = raw.trim();
    const key = area.toLowerCase();
    if (area && !seen.has(key)) {
      seen.add(key);
      out.push(area);
    }
  }
  return out;
}

export function validateKeeperProfile(input: {
  name: string;
  phone: string;
  areas: string[];
  note: string;
}): { ok: true; value: KeeperProfile } | { ok: false; errors: ProfileErrors } {
  const errors: ProfileErrors = {};

  const name = input.name.trim();
  if (!name) errors.name = "Tell hosts your name";
  else if (name.length > 60) errors.name = "At most 60 characters";

  const phone = normalizeBdPhone(input.phone);
  if (!phone) errors.phone = "Enter a Bangladeshi mobile number like 01712345678";

  const areas = dedupeAreas(input.areas);
  if (areas.length > MAX_AREAS) errors.areas = `Up to ${MAX_AREAS} areas`;
  else if (areas.some((a) => a.length > 40)) errors.areas = "Area names are at most 40 characters";

  const note = input.note.trim();
  if (note.length > 200) errors.note = "At most 200 characters";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, phone: phone as string, areas, note } };
}

function isProfile(value: unknown): value is KeeperProfile {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.name === "string" &&
    typeof p.phone === "string" &&
    typeof p.note === "string" &&
    Array.isArray(p.areas) &&
    p.areas.every((a) => typeof a === "string")
  );
}

// Storage can be missing or throw (private mode, blocked site data): treat that as "no profile".
export function readKeeperRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function parseKeeperProfile(raw: string | null): KeeperProfile | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isProfile(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function loadKeeperProfile(): KeeperProfile | null {
  return parseKeeperProfile(readKeeperRaw());
}

export function saveKeeperProfile(profile: KeeperProfile): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return true;
}

export function clearKeeperProfile(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing could have been stored.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// Fires for changes in this tab (CHANGE_EVENT) and other tabs ("storage").
export function subscribeKeeperProfile(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
```

`web/src/hooks/useKeeperProfile.ts`:

```ts
import { useMemo, useSyncExternalStore } from "react";
import { type KeeperProfile, parseKeeperProfile, readKeeperRaw, subscribeKeeperProfile } from "@/lib/keeper";

// Snapshot the raw string (stable between renders), parse once per change.
export function useKeeperProfile(): KeeperProfile | null {
  const raw = useSyncExternalStore(subscribeKeeperProfile, readKeeperRaw);
  return useMemo(() => parseKeeperProfile(raw), [raw]);
}
```

- [ ] **Step 5: Run tests + build** → pass.
- [ ] **Step 6: Commit** — `feat(web): keeper profile model stored on the device`

---

### Task 2: The /keeper page and entry points

**Interfaces:**
- Consumes: Task 1; `Link`, `usePath` from `@/lib/router`; `formatPhone` from `@/lib/contact`.
- Produces: `KeeperPage()` at `/keeper`; header link text "I'm a keeper" (no profile) or "My profile" (saved).

- [ ] **Step 1: Write failing tests**

`web/src/pages/KeeperPage.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { loadKeeperProfile, saveKeeperProfile } from "@/lib/keeper";
import { KeeperPage } from "./KeeperPage";

const type = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("KeeperPage", () => {
  it("saves a valid profile on this phone", () => {
    render(<KeeperPage />);
    type(/your name/i, "Mehedi");
    type(/whatsapp number/i, "019 1234 5678");
    type(/areas you play in/i, "Mirpur");
    fireEvent.click(screen.getByRole("button", { name: /add area/i }));
    type(/areas you play in/i, "Uttara"); // typed but not added: still saved
    type(/about you/i, "5 years in goal");
    fireEvent.click(screen.getByRole("button", { name: /save profile/i }));

    expect(screen.getByRole("status")).toHaveTextContent(/saved on this phone/i);
    expect(loadKeeperProfile()).toEqual({
      name: "Mehedi",
      phone: "8801912345678",
      areas: ["Mirpur", "Uttara"],
      note: "5 years in goal",
    });
  });

  it("adds areas with Enter and removes them", () => {
    render(<KeeperPage />);
    const areaInput = screen.getByLabelText(/areas you play in/i);
    fireEvent.change(areaInput, { target: { value: "Agrabad" } });
    fireEvent.keyDown(areaInput, { key: "Enter" });
    expect(screen.getByRole("button", { name: "Remove Agrabad" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove Agrabad" }));
    expect(screen.queryByRole("button", { name: "Remove Agrabad" })).toBeNull();
  });

  it("shows field errors and saves nothing", () => {
    render(<KeeperPage />);
    type(/whatsapp number/i, "123");
    fireEvent.click(screen.getByRole("button", { name: /save profile/i }));
    expect(screen.getByText("Tell hosts your name")).toBeInTheDocument();
    expect(screen.getByText(/bangladeshi mobile number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/whatsapp number/i)).toHaveAttribute("aria-invalid", "true");
    expect(loadKeeperProfile()).toBeNull();
  });

  it("prefills a saved profile and deletes it", () => {
    saveKeeperProfile({ name: "Mehedi", phone: "8801912345678", areas: ["Mirpur"], note: "" });
    render(<KeeperPage />);
    expect(screen.getByLabelText(/your name/i)).toHaveValue("Mehedi");
    expect(screen.getByLabelText(/whatsapp number/i)).toHaveValue("01912-345678");
    expect(screen.getByRole("button", { name: "Remove Mirpur" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /delete profile/i }));
    expect(loadKeeperProfile()).toBeNull();
    expect(screen.getByLabelText(/your name/i)).toHaveValue("");
  });
});
```

In `web/src/App.test.tsx`, add the import `import { saveKeeperProfile } from "@/lib/keeper";` and append:

```tsx
it("routes /keeper to the keeper profile page", () => {
  window.history.pushState(null, "", "/keeper");
  render(<App />);
  expect(screen.getByRole("heading", { level: 1, name: /your keeper profile/i })).toBeInTheDocument();
});

it("links keepers to their profile from the header", () => {
  const { unmount } = render(<App />);
  expect(within(screen.getByRole("banner")).getByRole("link", { name: "I'm a keeper" })).toHaveAttribute("href", "/keeper");
  unmount();
  saveKeeperProfile({ name: "Mehedi", phone: "8801912345678", areas: [], note: "" });
  render(<App />);
  expect(within(screen.getByRole("banner")).getByRole("link", { name: "My profile" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: Implement `web/src/pages/KeeperPage.tsx`**

```tsx
import { X } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useState } from "react";
import { GlowCard } from "@/components/GlowCard";
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
    <div className="mx-auto max-w-xl py-10 pb-20">
      <h1 className="text-3xl font-bold sm:text-4xl">Your keeper profile</h1>
      <p className="mt-3 text-muted-foreground">
        Save your details once. They stay on this phone and fill in "I'm interested" for you. A host only sees them
        when you send a request.
      </p>

      <GlowCard className="mt-8 p-6 sm:p-8">
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
      </GlowCard>
    </div>
  );
}
```

Replace `web/src/App.tsx`:

```tsx
import { AppShell } from "@/components/AppShell";
import { matchPostPath, usePath } from "@/lib/router";
import { HomePage } from "@/pages/HomePage";
import { KeeperPage } from "@/pages/KeeperPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PostPage } from "@/pages/PostPage";

export default function App() {
  const path = usePath();
  const postId = matchPostPath(path);

  let page;
  if (path === "/") page = <HomePage />;
  else if (path === "/keeper") page = <KeeperPage />;
  else if (postId) page = <PostPage key={postId} id={postId} />;
  else page = <NotFoundPage />;

  return <AppShell>{page}</AppShell>;
}
```

In `web/src/components/AppShell.tsx`: import `useKeeperProfile` from `@/hooks/useKeeperProfile`; inside the component, `const keeper = useKeeperProfile();`; change the header's class to `mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5` and add after the brand `Link`:

```tsx
          <Link to="/keeper" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
            {keeper ? "My profile" : "I'm a keeper"}
          </Link>
```

In `web/src/pages/HomePage.tsx`: import `Link` from `@/lib/router`; wrap the existing "See open games" `<a>` in `<div className="mt-8 flex flex-wrap items-center justify-center gap-3">…</div>` (removing `mt-8` from the `<a>`), and add inside it after the `<a>`:

```tsx
            <Link
              to="/keeper"
              className="inline-flex items-center rounded-full border px-5 py-2.5 font-semibold hover:border-primary hover:text-primary"
            >
              I'm a keeper
            </Link>
```

In `App.test.tsx`, the existing brand assertion stays valid (`toHaveTextContent` matches a substring). Add `within` to its Testing Library import if not already there.

- [ ] **Step 4: Run tests + build** → pass.
- [ ] **Step 5: Commit** — `feat(web): keeper profile page with header and hero entry points`

---

### Task 3: Feed opens on the keeper's areas

**Interfaces:**
- Consumes: `useKeeperProfile`.
- Produces: `MY_AREAS_KEY = "__mine"` exported from `AreaChips.tsx`; `AreaChips` gains `showMine?: boolean` (renders a "My areas" chip after "All").

- [ ] **Step 1: Write failing tests** — append to `web/src/components/feed/Feed.test.tsx` (add `import { saveKeeperProfile } from "@/lib/keeper";`):

```tsx
describe("Feed with a keeper profile", () => {
  const keeper = (areas: string[]) =>
    saveKeeperProfile({ name: "Mehedi", phone: "8801912345678", areas, note: "" });

  it("opens on the keeper's areas", async () => {
    keeper(["agrabad"]);
    mockFetch({ posts: POSTS });
    render(<Feed now={NOW} />);

    expect(await screen.findByRole("button", { name: /my areas/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("7:30 PM")).toBeNull();
    expect(screen.getByText("6:00 PM")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^all/i }));
    expect(screen.getByText("7:30 PM")).toBeInTheDocument();
  });

  it("shows everything when none of the keeper's areas have games", async () => {
    keeper(["Sylhet"]);
    mockFetch({ posts: POSTS });
    render(<Feed now={NOW} />);

    expect(await screen.findByText("7:30 PM")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /my areas/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: Implement**

In `web/src/components/feed/AreaChips.tsx`: add `export const MY_AREAS_KEY = "__mine";`, add `showMine = false` to the props (type `showMine?: boolean`), and render the chip right after "All":

```tsx
      {chip(null, "All")}
      {showMine && chip(MY_AREAS_KEY, "My areas")}
      {options.map((o) => chip(o.key, o.label, o.count))}
```

In `web/src/components/feed/Feed.tsx`:

- imports: `import { useMemo, useState } from "react";`, `import { useKeeperProfile } from "@/hooks/useKeeperProfile";`, and `MY_AREAS_KEY` from `./AreaChips`.
- replace `const [area, setArea] = useState<string | null>(null);` and the `visible` line with:

```tsx
  const keeper = useKeeperProfile();
  const myAreas = useMemo(() => new Set((keeper?.areas ?? []).map((a) => a.trim().toLowerCase())), [keeper]);
  // undefined = the viewer hasn't picked a chip yet, so default to their areas when those have games.
  const [area, setArea] = useState<string | null | undefined>(undefined);

  const posts = state.status === "ready" ? state.data : [];
  const areaKey = (p: { area: string }) => p.area.trim().toLowerCase();
  const hasMine = posts.some((p) => myAreas.has(areaKey(p)));
  const selected = area !== undefined ? area : hasMine ? MY_AREAS_KEY : null;
  const visible =
    selected === MY_AREAS_KEY
      ? posts.filter((p) => myAreas.has(areaKey(p)))
      : selected
        ? posts.filter((p) => areaKey(p) === selected)
        : posts;
```

(delete the old `const posts = …` line, which this block replaces), and pass the new props:

```tsx
            <AreaChips
              options={areaOptions(posts.map((p) => p.area))}
              selected={selected}
              onSelect={setArea}
              showMine={hasMine}
            />
```

- [ ] **Step 4: Run tests + build** → pass.
- [ ] **Step 5: Commit** — `feat(web): feed opens on the keeper's saved areas`

---

### Task 4: Check, docs, ship

- [ ] **Step 1: Visual check** — local API + web dev servers with seed data; screenshot `/keeper` (empty, with errors, saved) at 1280 and 400 px, and `/` after saving areas `Mirpur`: "My areas" chip pressed, only Mirpur games. No horizontal scroll, no console errors.
- [ ] **Step 2: Spec** — in `docs/superpowers/specs/2026-09-21-khelbinaki-design.md` §8, set the order to: `4a Contact modes API` → `4b Keeper profile (on-device)` → `4c Contact on the site (Turnstile widget, reveal button, "I'm interested" form pre-filled from the keeper profile; cards drop phone)` → `4d Post a match + manage page (contact-mode choice, interested keepers, mark filled, prominent "Share your post")` → `4e Share everywhere (native share sheet on phones — Facebook, Messenger, WhatsApp, Telegram, Viber, imo…; desktop buttons for WhatsApp, Facebook incl. groups, Telegram, copy link; per-post link previews via Open Graph tags injected by the web Worker with HTMLRewriter)` → `5 Design sync (apply the redesign canvas https://claude.ai/artifact/LvyPfzuNcjuk76DmDZ7tgi across all pages)` → `6 Buy me a cha` → `7 Polish`. Add a line under §9: keeper onboarding = on-device profile only (owner, 2026-09-22); public keeper list, alerts and first-visit guide not planned.
- [ ] **Step 3: `CLAUDE.md`** — under "Key behaviors" add: `5. **Keeper profile** lives only in the keeper's browser (localStorage key khelbinaki.keeper.v1): name, WhatsApp, areas, note. It pre-fills "I'm interested" and makes the feed open on the keeper's areas. Never send it anywhere except with an interest request.`
- [ ] **Step 4: Merge to `main`, push** (Workers Builds deploys the site; no API change).
