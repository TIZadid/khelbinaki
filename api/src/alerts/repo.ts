export type AlertChannel = "push" | "telegram";
export type Alert = { id: string; channel: AlertChannel; address: string; areas: string };

/** Areas are stored as a lowercase comma-separated list; empty means "anywhere". */
export function normalizeAreas(areas: string[]): string {
  const seen = new Set<string>();
  for (const area of areas) {
    const trimmed = area.trim().toLowerCase();
    if (trimmed) seen.add(trimmed);
  }
  return [...seen].slice(0, 5).join(",");
}

export function wantsArea(alertAreas: string, area: string): boolean {
  if (!alertAreas) return true;
  return alertAreas.split(",").includes(area.trim().toLowerCase());
}

export async function saveAlert(
  db: D1Database,
  id: string,
  channel: AlertChannel,
  address: string,
  areas: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO alerts (id, channel, address, areas) VALUES (?, ?, ?, ?)
       ON CONFLICT (channel, address) DO UPDATE SET areas = excluded.areas`,
    )
    .bind(id, channel, address, areas)
    .run();
}

export async function deleteAlert(db: D1Database, channel: AlertChannel, address: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM alerts WHERE channel = ? AND address = ?").bind(channel, address).run();
  return result.meta.changes > 0;
}

/** Everyone watching this area, plus everyone watching everywhere. */
export async function listAlertsFor(db: D1Database, area: string): Promise<Alert[]> {
  const { results } = await db
    .prepare("SELECT id, channel, address, areas FROM alerts WHERE areas = '' OR instr(',' || areas || ',', ?) > 0")
    .bind(`,${area.trim().toLowerCase()},`)
    .all<Alert>();
  return results;
}

export async function saveTelegramCode(db: D1Database, code: string, areas: string): Promise<void> {
  await db.prepare("INSERT OR REPLACE INTO telegram_links (code, areas) VALUES (?, ?)").bind(code, areas).run();
}

/** One-use: the code is spent as soon as the keeper opens the bot. */
export async function takeTelegramCode(db: D1Database, code: string): Promise<string | null> {
  const row = await db.prepare("SELECT areas FROM telegram_links WHERE code = ?").bind(code).first<{ areas: string }>();
  if (!row) return null;
  await db.prepare("DELETE FROM telegram_links WHERE code = ?").bind(code).run();
  return row.areas;
}
