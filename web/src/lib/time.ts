// All user-facing times are Bangladesh time, whatever the viewer's device says.
const TZ = "Asia/Dhaka";
const MINUTE = 60_000;
const DAY = 86_400_000;
const SOON_MS = 3 * 60 * MINUTE;

export type GroupKey = "today" | "tomorrow" | "week" | "later";

const GROUP_ORDER: GroupKey[] = ["today", "tomorrow", "week", "later"];
const GROUP_LABELS: Record<GroupKey, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  week: "This week",
  later: "Later",
};

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFormat = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const labelFormat = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });

// YYYY-MM-DD on a Bangladeshi calendar.
export function dhakaDay(d: Date): string {
  return dayFormat.format(d);
}

export function groupKey(start: Date, now: Date): GroupKey {
  const diff = Math.round((Date.parse(dhakaDay(start)) - Date.parse(dhakaDay(now))) / DAY);
  if (diff <= 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff < 7) return "week";
  return "later";
}

export function groupPosts<T extends { start_datetime: string }>(posts: T[], now: Date) {
  const buckets = new Map<GroupKey, T[]>();
  for (const post of posts) {
    const key = groupKey(new Date(post.start_datetime), now);
    buckets.set(key, [...(buckets.get(key) ?? []), post]);
  }
  return GROUP_ORDER.filter((key) => buckets.has(key)).map((key) => ({
    key,
    label: GROUP_LABELS[key],
    posts: buckets.get(key) as T[],
  }));
}

export function isStartingSoon(start: Date, now: Date): boolean {
  const ms = start.getTime() - now.getTime();
  return ms > 0 && ms <= SOON_MS;
}

// Newer ICU puts a narrow no-break space before AM/PM; normalise to a plain space.
export function formatTime(d: Date): string {
  return timeFormat.format(d).replace(/ /g, " ");
}

export function formatDay(d: Date): string {
  return labelFormat.format(d).replace(",", "");
}

export function formatCountdown(start: Date, now: Date): string {
  const mins = Math.max(0, Math.round((start.getTime() - now.getTime()) / MINUTE));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `in ${h}h ${String(m).padStart(2, "0")}m` : `in ${m}m`;
}

// Two countdown boxes for the "Next up" ticket: HRS:MIN under a day, DAYS:HRS after.
export function countdownParts(start: Date, now: Date): [{ value: string; label: string }, { value: string; label: string }] {
  const mins = Math.max(0, Math.floor((start.getTime() - now.getTime()) / MINUTE));
  const pad = (n: number) => String(n).padStart(2, "0");
  const days = Math.floor(mins / (24 * 60));
  if (days >= 1) {
    return [
      { value: pad(days), label: days === 1 ? "DAY" : "DAYS" },
      { value: pad(Math.floor(mins / 60) % 24), label: "HRS" },
    ];
  }
  return [
    { value: pad(Math.floor(mins / 60)), label: "HRS" },
    { value: pad(mins % 60), label: "MIN" },
  ];
}
