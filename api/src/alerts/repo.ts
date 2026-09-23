export type AlertChannel = "push" | "telegram";
import { isRegion } from "../lib/bd";

export type Alert = { id: string; channel: AlertChannel; address: string; regions: string };

/**
 * Regions are districts or whole divisions, stored as a lowercase comma-separated
 * list. Empty means "anywhere in Bangladesh". Unknown names are dropped.
 */
export function normalizeRegions(regions: string[]): string {
  const seen = new Set<string>();
  for (const region of regions) {
    const slug = region.trim().toLowerCase();
    if (slug && isRegion(slug)) seen.add(slug);
  }
  return [...seen].slice(0, 8).join(",");
}

export function wantsRegion(alertRegions: string, district: string, division: string): boolean {
  if (!alertRegions) return true;
  const wanted = alertRegions.split(",");
  return wanted.includes(district.toLowerCase()) || wanted.includes(division.toLowerCase());
}

export async function saveAlert(
  db: D1Database,
  id: string,
  channel: AlertChannel,
  address: string,
  regions: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO alerts (id, channel, address, regions) VALUES (?, ?, ?, ?)
       ON CONFLICT (channel, address) DO UPDATE SET regions = excluded.regions`,
    )
    .bind(id, channel, address, regions)
    .run();
}

export async function deleteAlert(db: D1Database, channel: AlertChannel, address: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM alerts WHERE channel = ? AND address = ?").bind(channel, address).run();
  return result.meta.changes > 0;
}

/** Everyone following this district or its division, plus everyone following everywhere. */
export async function listAlertsFor(db: D1Database, district: string, division: string): Promise<Alert[]> {
  const { results } = await db
    .prepare(
      `SELECT id, channel, address, regions FROM alerts
       WHERE regions = '' OR instr(',' || regions || ',', ?) > 0 OR instr(',' || regions || ',', ?) > 0`,
    )
    .bind(`,${district.toLowerCase()},`, `,${division.toLowerCase()},`)
    .all<Alert>();
  return results;
}

export async function saveTelegramCode(db: D1Database, code: string, regions: string): Promise<void> {
  await db.prepare("INSERT OR REPLACE INTO telegram_links (code, regions) VALUES (?, ?)").bind(code, regions).run();
}

type TelegramLink = { regions: string; chat_id: string | null };

/**
 * The first chat to open the bot with a code claims it; after that the code only
 * works for that same chat. Returns the regions to watch, or null if it's unknown
 * or already claimed by someone else.
 */
export async function claimTelegramCode(db: D1Database, code: string, chatId: string): Promise<string | null> {
  const row = await db.prepare("SELECT regions, chat_id FROM telegram_links WHERE code = ?").bind(code).first<TelegramLink>();
  if (!row || (row.chat_id !== null && row.chat_id !== chatId)) return null;
  if (row.chat_id === null) await db.prepare("UPDATE telegram_links SET chat_id = ? WHERE code = ?").bind(chatId, code).run();
  return row.regions;
}

export type TelegramStatus =
  | { status: "unknown" }
  | { status: "waiting" } // code handed out, Start not tapped yet
  | { status: "linked"; regions: string }
  | { status: "stopped" }; // they sent /stop, or turned it off from the site

export async function telegramStatus(db: D1Database, code: string): Promise<TelegramStatus> {
  const row = await db.prepare("SELECT regions, chat_id FROM telegram_links WHERE code = ?").bind(code).first<TelegramLink>();
  if (!row) return { status: "unknown" };
  if (row.chat_id === null) return { status: "waiting" };
  const alert = await db
    .prepare("SELECT regions FROM alerts WHERE channel = 'telegram' AND address = ?")
    .bind(row.chat_id)
    .first<{ regions: string }>();
  return alert ? { status: "linked", regions: alert.regions } : { status: "stopped" };
}

/** The chat a claimed code points at, or null. */
export async function telegramChatFor(db: D1Database, code: string): Promise<string | null> {
  const row = await db.prepare("SELECT chat_id FROM telegram_links WHERE code = ?").bind(code).first<{ chat_id: string | null }>();
  return row?.chat_id ?? null;
}

/** Changes the places of an existing alert. False when there's no such alert. */
export async function updateAlertRegions(
  db: D1Database,
  channel: AlertChannel,
  address: string,
  regions: string,
): Promise<boolean> {
  const result = await db
    .prepare("UPDATE alerts SET regions = ? WHERE channel = ? AND address = ?")
    .bind(regions, channel, address)
    .run();
  return result.meta.changes > 0;
}

export async function alertRegions(db: D1Database, channel: AlertChannel, address: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT regions FROM alerts WHERE channel = ? AND address = ?")
    .bind(channel, address)
    .first<{ regions: string }>();
  return row?.regions ?? null;
}
