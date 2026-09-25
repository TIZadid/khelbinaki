import { normalizeRegions } from "../alerts/repo";
import { randomId, randomToken } from "../lib/random";
import { normalizeBdPhone } from "../posts/validate";

// Optional accounts, backed by Telegram. The Telegram user id is the identity:
// only Telegram can put it in a bot update, so pressing Start (or typing a code
// a bot sent) proves who someone is. No passwords, no SMS.

export const LINK_CODE_MINUTES = 15;
export const OTP_MINUTES = 10;

export type Account = { name: string; phone: string | null; note: string; regions: string[] };
type AccountRow = { tg_id: string; name: string; phone: string | null; note: string; regions: string };

const toAccount = (row: AccountRow): Account => ({
  name: row.name,
  phone: row.phone,
  note: row.note,
  regions: row.regions ? row.regions.split(",") : [],
});

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Makes the account on first sign-in; later sign-ins only mark it as used. */
export async function ensureAccount(db: D1Database, tgId: string, telegramName: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO accounts (tg_id, name) VALUES (?, ?)
       ON CONFLICT (tg_id) DO UPDATE SET last_seen_at = datetime('now')`,
    )
    .bind(tgId, telegramName.trim().slice(0, 60))
    .run();
}

export async function getAccount(db: D1Database, tgId: string): Promise<Account | null> {
  const row = await db.prepare("SELECT * FROM accounts WHERE tg_id = ?").bind(tgId).first<AccountRow>();
  return row ? toAccount(row) : null;
}

// ---- Sign-in codes ------------------------------------------------------------

/** A code for the site to hand out; a bot claims it when /start login_<code> arrives. */
export async function createLinkCode(db: D1Database): Promise<string> {
  const code = randomId(24);
  await db.prepare("INSERT INTO login_codes (code, kind) VALUES (?, 'link')").bind(code).run();
  return code;
}

/** The bot saw /start login_<code> from this Telegram user. False if unknown, used or expired. */
export async function claimLinkCode(db: D1Database, code: string, tgId: string): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE login_codes SET tg_id = ?
       WHERE code = ? AND kind = 'link' AND tg_id IS NULL
         AND created_at > datetime('now', '-${LINK_CODE_MINUTES} minutes')`,
    )
    .bind(tgId, code)
    .run();
  return result.meta.changes > 0;
}

/**
 * The site polls with its link code. Once a bot has claimed it, the code is swapped
 * for a session — in one statement, so it can only ever be swapped once.
 */
export async function pollLinkCode(
  db: D1Database,
  code: string,
): Promise<{ status: "waiting" } | { status: "signed_in"; tgId: string } | null> {
  const taken = await db
    .prepare("DELETE FROM login_codes WHERE code = ? AND kind = 'link' AND tg_id IS NOT NULL RETURNING tg_id")
    .bind(code)
    .first<{ tg_id: string }>();
  if (taken) return { status: "signed_in", tgId: taken.tg_id };
  const waiting = await db
    .prepare(
      `SELECT 1 FROM login_codes WHERE code = ? AND kind = 'link'
       AND created_at > datetime('now', '-${LINK_CODE_MINUTES} minutes')`,
    )
    .bind(code)
    .first();
  return waiting ? { status: "waiting" } : null;
}

/** /login in a bot: a 6-digit code for signing in on a device without Telegram. */
export async function createOtp(db: D1Database, tgId: string): Promise<string> {
  // One live code per person: a new /login replaces the old one.
  await db.prepare("DELETE FROM login_codes WHERE kind = 'otp' AND tg_id = ?").bind(tgId).run();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
    const result = await db.prepare("INSERT OR IGNORE INTO login_codes (code, kind, tg_id) VALUES (?, 'otp', ?)").bind(code, tgId).run();
    if (result.meta.changes > 0) return code;
  }
  throw new Error("Couldn't find a free sign-in code");
}

/** A typed code: used up in the same statement that checks it. */
export async function redeemOtp(db: D1Database, code: string): Promise<string | null> {
  if (!/^\d{6}$/.test(code)) return null;
  const row = await db
    .prepare(
      `DELETE FROM login_codes WHERE code = ? AND kind = 'otp'
       AND created_at > datetime('now', '-${OTP_MINUTES} minutes') RETURNING tg_id`,
    )
    .bind(code)
    .first<{ tg_id: string }>();
  return row?.tg_id ?? null;
}

// ---- Sessions -------------------------------------------------------------------

export async function createSession(db: D1Database, tgId: string): Promise<string> {
  const token = randomToken();
  await db.prepare("INSERT INTO sessions (token_hash, tg_id) VALUES (?, ?)").bind(await sha256(token), tgId).run();
  return token;
}

/** The account id behind a bearer token, or null. Also marks the session and account as used. */
export async function sessionAccount(db: D1Database, authorization: string | undefined): Promise<string | null> {
  const token = authorization?.replace(/^Bearer\s+/i, "") ?? "";
  if (token.length < 20) return null;
  const hash = await sha256(token);
  const row = await db.prepare("SELECT tg_id FROM sessions WHERE token_hash = ?").bind(hash).first<{ tg_id: string }>();
  if (!row) return null;
  await db.batch([
    db.prepare("UPDATE sessions SET last_used_at = datetime('now') WHERE token_hash = ?").bind(hash),
    db.prepare("UPDATE accounts SET last_seen_at = datetime('now') WHERE tg_id = ?").bind(row.tg_id),
  ]);
  return row.tg_id;
}

export async function endSession(db: D1Database, authorization: string | undefined): Promise<void> {
  const token = authorization?.replace(/^Bearer\s+/i, "") ?? "";
  if (token) await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
}

// ---- Profile --------------------------------------------------------------------

export function validateProfile(input: unknown):
  | { ok: true; value: { name: string; note: string; regions: string } }
  | { ok: false; errors: Record<string, string> } {
  const body = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!name) errors.name = "Required";
  else if (name.length > 60) errors.name = "At most 60 characters";
  if (note.length > 200) errors.note = "At most 200 characters";
  const list = Array.isArray(body.regions) ? body.regions.filter((r): r is string => typeof r === "string") : [];
  const regions = normalizeRegions(list).split(",").filter(Boolean).slice(0, 5).join(",");
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, note, regions } };
}

export async function updateProfile(db: D1Database, tgId: string, profile: { name: string; note: string; regions: string }) {
  await db
    .prepare("UPDATE accounts SET name = ?, note = ?, regions = ? WHERE tg_id = ?")
    .bind(profile.name, profile.note, profile.regions, tgId)
    .run();
}

/** Share my number in a bot. Only their own number, only Bangladeshi mobiles. */
export async function saveVerifiedPhone(
  db: D1Database,
  tgId: string,
  contact: { phone_number?: unknown; user_id?: unknown },
): Promise<"saved" | "not_theirs" | "not_bd"> {
  if (String(contact.user_id ?? "") !== tgId) return "not_theirs";
  const phone = typeof contact.phone_number === "string" ? normalizeBdPhone(contact.phone_number) : null;
  if (!phone) return "not_bd";
  await db.prepare("UPDATE accounts SET phone = ? WHERE tg_id = ?").bind(phone, tgId).run();
  return "saved";
}

/** Posts this account made, with their manage tokens (only the owner ever sees these). */
export async function ownedPosts(db: D1Database, tgId: string): Promise<{ id: string; token: string }[]> {
  const { results } = await db
    .prepare("SELECT id, edit_token AS token FROM posts WHERE owner_tg_id = ? ORDER BY start_datetime DESC LIMIT 50")
    .bind(tgId)
    .all<{ id: string; token: string }>();
  return results;
}

/** Delete my data: the account, its sessions and Telegram alerts; its posts stay but lose their owner. */
export async function deleteAccount(db: D1Database, tgId: string): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM sessions WHERE tg_id = ?").bind(tgId),
    db.prepare("DELETE FROM login_codes WHERE tg_id = ?").bind(tgId),
    db.prepare("DELETE FROM alerts WHERE channel IN ('telegram', 'telegram_opp') AND address = ?").bind(tgId),
    db.prepare("DELETE FROM telegram_links WHERE chat_id = ?").bind(tgId),
    db.prepare("UPDATE posts SET owner_tg_id = NULL WHERE owner_tg_id = ?").bind(tgId),
    db.prepare("DELETE FROM accounts WHERE tg_id = ?").bind(tgId),
  ]);
}

export { toAccount, type AccountRow };
