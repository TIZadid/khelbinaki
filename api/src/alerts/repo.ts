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

/** One-use: the code is spent as soon as the keeper opens the bot. */
export async function takeTelegramCode(db: D1Database, code: string): Promise<string | null> {
  const row = await db.prepare("SELECT regions FROM telegram_links WHERE code = ?").bind(code).first<{ regions: string }>();
  if (!row) return null;
  await db.prepare("DELETE FROM telegram_links WHERE code = ?").bind(code).run();
  return row.regions;
}
