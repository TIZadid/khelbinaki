export type NewPost = {
  host_name: string;
  phone: string;
  area: string;
  turf_name: string | null;
  start_datetime: string;
  duration_minutes: number | null;
  cost_per_head: number | null;
  slots_needed: number;
  notes: string | null;
};

export type Validation<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

const MAX_DAYS_AHEAD = 60;
const DAY_MS = 86_400_000;

// Bangladeshi mobile: 01[3-9] + 8 digits, optional 88 country code. Stored as 8801XXXXXXXXX for wa.me.
export function normalizeBdPhone(raw: string): string | null {
  const match = /^(?:88)?(01[3-9]\d{8})$/.exec(raw.replace(/\D/g, ""));
  return match ? `88${match[1]}` : null;
}

export function validateNewPost(input: unknown, now: Date): Validation<NewPost> {
  const body = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const text = (key: string, max: number, required: boolean): string | null => {
    const value = body[key];
    if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
      if (required) errors[key] = "Required";
      return null;
    }
    if (typeof value !== "string") {
      errors[key] = "Must be text";
      return null;
    }
    const trimmed = value.trim();
    if (trimmed.length > max) {
      errors[key] = `At most ${max} characters`;
      return null;
    }
    return trimmed;
  };

  const int = (key: string, min: number, max: number): number | null => {
    const value = body[key];
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
      errors[key] = `Whole number from ${min} to ${max}`;
      return null;
    }
    return value;
  };

  if (body.listing_type !== undefined && body.listing_type !== "gk_needed") {
    errors.listing_type = "Only gk_needed posts are supported for now";
  }

  const host_name = text("host_name", 60, true);
  const area = text("area", 60, true);
  const turf_name = text("turf_name", 80, false);
  const notes = text("notes", 500, false);
  const duration_minutes = int("duration_minutes", 15, 240);
  const cost_per_head = int("cost_per_head", 0, 10_000);
  const slots_needed = int("slots_needed", 1, 5) ?? 1;

  let phone: string | null = null;
  const rawPhone = text("phone", 20, true);
  if (rawPhone !== null) {
    phone = normalizeBdPhone(rawPhone);
    if (!phone) errors.phone = "Enter a Bangladeshi mobile number like 01712345678";
  }

  let start_datetime: string | null = null;
  const rawStart = text("start_datetime", 40, true);
  if (rawStart !== null) {
    const date = new Date(rawStart);
    if (Number.isNaN(date.getTime())) errors.start_datetime = "Invalid date/time";
    else if (!/(Z|[+-]\d{2}:\d{2})$/i.test(rawStart)) errors.start_datetime = "Include a timezone";
    else if (date <= now) errors.start_datetime = "Must be in the future";
    else if (date.getTime() - now.getTime() > MAX_DAYS_AHEAD * DAY_MS)
      errors.start_datetime = `At most ${MAX_DAYS_AHEAD} days ahead`;
    else start_datetime = date.toISOString();
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      host_name: host_name as string,
      phone: phone as string,
      area: area as string,
      turf_name,
      start_datetime: start_datetime as string,
      duration_minutes,
      cost_per_head,
      slots_needed,
      notes,
    },
  };
}
