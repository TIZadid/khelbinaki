import { isRegion } from "../lib/bd";

// "telegram" is @gklagbebot, "telegram_opp" is @opponentlagbebot.
export type AlertChannel = "push" | "telegram" | "telegram_opp";
export type Board = "gk_needed" | "opponent_needed";
export type BotKey = "gk" | "opp";

export const BOARDS: readonly Board[] = ["gk_needed", "opponent_needed"];

export type Alert = { id: string; channel: AlertChannel; address: string; regions: string; boards: string };

/** Known boards only, unique, comma-joined; "" when none are valid. */
export function normalizeBoards(input: unknown): string {
  const list = Array.isArray(input) ? input : [];
  return BOARDS.filter((board) => list.includes(board)).join(",");
}

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
  boards = "gk_needed",
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO alerts (id, channel, address, regions, boards) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (channel, address) DO UPDATE SET regions = excluded.regions, boards = excluded.boards`,
    )
    .bind(id, channel, address, regions, boards)
    .run();
}

export async function deleteAlert(db: D1Database, channel: AlertChannel, address: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM alerts WHERE channel = ? AND address = ?").bind(channel, address).run();
  return result.meta.changes > 0;
}

/** Everyone who wants this board and follows this district, its division, or everywhere. */
export async function listAlertsFor(
  db: D1Database,
  district: string,
  division: string,
  board: Board = "gk_needed",
): Promise<Alert[]> {
  const { results } = await db
    .prepare(
      `SELECT id, channel, address, regions, boards FROM alerts
       WHERE instr(',' || boards || ',', ?) > 0
         AND (regions = '' OR instr(',' || regions || ',', ?) > 0 OR instr(',' || regions || ',', ?) > 0)`,
    )
    .bind(`,${board},`, `,${district.toLowerCase()},`, `,${division.toLowerCase()},`)
    .all<Alert>();
  return results;
}

export async function saveTelegramCode(db: D1Database, code: string, regions: string, bot: BotKey = "gk"): Promise<void> {
  await db
    .prepare("INSERT OR REPLACE INTO telegram_links (code, regions, bot) VALUES (?, ?, ?)")
    .bind(code, regions, bot)
    .run();
}

type TelegramLink = { regions: string; chat_id: string | null; bot: BotKey };

export const channelOf = (bot: BotKey): AlertChannel => (bot === "opp" ? "telegram_opp" : "telegram");
export const boardOf = (bot: BotKey): Board => (bot === "opp" ? "opponent_needed" : "gk_needed");

/**
 * The first chat to open the bot with a code claims it; after that the code only
 * works for that same chat. Returns the regions to watch, or null if it's unknown
 * or already claimed by someone else.
 */
export async function claimTelegramCode(
  db: D1Database,
  code: string,
  chatId: string,
  bot: BotKey = "gk",
): Promise<string | null> {
  const row = await db.prepare("SELECT regions, chat_id, bot FROM telegram_links WHERE code = ?").bind(code).first<TelegramLink>();
  // A code only works in the bot it was made for.
  if (!row || row.bot !== bot || (row.chat_id !== null && row.chat_id !== chatId)) return null;
  if (row.chat_id === null) await db.prepare("UPDATE telegram_links SET chat_id = ? WHERE code = ?").bind(chatId, code).run();
  return row.regions;
}

export type TelegramStatus =
  | { status: "unknown" }
  | { status: "waiting"; board: Board } // code handed out, Start not tapped yet
  | { status: "linked"; regions: string; board: Board }
  | { status: "stopped"; board: Board }; // they sent /stop, or turned it off from the site

export async function telegramStatus(db: D1Database, code: string): Promise<TelegramStatus> {
  const row = await db.prepare("SELECT regions, chat_id, bot FROM telegram_links WHERE code = ?").bind(code).first<TelegramLink>();
  if (!row) return { status: "unknown" };
  const board = boardOf(row.bot);
  if (row.chat_id === null) return { status: "waiting", board };
  const regions = await alertRegions(db, channelOf(row.bot), row.chat_id);
  return regions === null ? { status: "stopped", board } : { status: "linked", regions, board };
}

/** The chat (and its bot's channel) a claimed code points at, or null. */
export async function telegramChatFor(db: D1Database, code: string): Promise<{ chatId: string; channel: AlertChannel } | null> {
  const row = await db.prepare("SELECT chat_id, bot FROM telegram_links WHERE code = ?").bind(code).first<{ chat_id: string | null; bot: BotKey }>();
  return row?.chat_id ? { chatId: row.chat_id, channel: channelOf(row.bot) } : null;
}

/** Changes the places of an existing alert. False when there's no such alert. */
export async function updateAlertRegions(
  db: D1Database,
  channel: AlertChannel,
  address: string,
  regions: string,
  boards?: string,
): Promise<boolean> {
  const result = await (boards
    ? db.prepare("UPDATE alerts SET regions = ?, boards = ? WHERE channel = ? AND address = ?").bind(regions, boards, channel, address)
    : db.prepare("UPDATE alerts SET regions = ? WHERE channel = ? AND address = ?").bind(regions, channel, address)
  ).run();
  return result.meta.changes > 0;
}

export async function alertRegions(db: D1Database, channel: AlertChannel, address: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT regions FROM alerts WHERE channel = ? AND address = ?")
    .bind(channel, address)
    .first<{ regions: string }>();
  return row?.regions ?? null;
}
