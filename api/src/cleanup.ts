// Keeps the free D1 database small and doesn't hold people's numbers longer than
// needed. Runs hourly from the Cron Trigger in wrangler.jsonc.
//
// A post leaves the boards at kick-off (query-time filter). Once its slot ends it
// is archived; a while later it is deleted for good, with any interest requests
// (names + WhatsApp numbers) attached to it.
export const RETENTION = {
  /** Slot length assumed when the host didn't give one. */
  defaultSlotMinutes: 120,
  /** How long an ended post (and its requests) is kept before it's deleted. */
  deleteAfterHours: 48,
  /** Telegram link codes nobody used, or whose alerts were turned off. */
  staleTelegramHours: 24,
  /** Telegram-backed accounts nobody has used in this long are deleted. */
  accountDays: 180,
  /** Signed-in sessions unused this long end. */
  sessionDays: 60,
  /** Sign-in codes (links and 6-digit codes) are short-lived anyway. */
  loginCodeHours: 24,
} as const;

const slotEnd = `datetime(start_datetime, '+' || COALESCE(duration_minutes, ${RETENTION.defaultSlotMinutes}) || ' minutes')`;

export type CleanupResult = {
  archived: number;
  deleted: number;
  requests: number;
  telegramLinks: number;
  accounts: number;
  sessions: number;
};

export async function cleanup(db: D1Database, now: Date): Promise<CleanupResult> {
  const at = now.toISOString();
  const expired = `${slotEnd} <= datetime(?, '-${RETENTION.deleteAfterHours} hours')`;
  const stale = `created_at <= datetime(?, '-${RETENTION.staleTelegramHours} hours')`;

  const staleAccounts = `SELECT tg_id FROM accounts WHERE last_seen_at <= datetime(?, '-${RETENTION.accountDays} days')`;

  const [archived, requests, deleted, unclaimed, stopped, , , , , accounts, sessions] = await db.batch([
    db.prepare(`UPDATE posts SET status = 'archived' WHERE status != 'archived' AND ${slotEnd} <= datetime(?)`).bind(at),
    // Requests go first so nothing depends on foreign-key cascades being switched on.
    db.prepare(`DELETE FROM interests WHERE post_id IN (SELECT id FROM posts WHERE ${expired})`).bind(at),
    db.prepare(`DELETE FROM posts WHERE ${expired}`).bind(at),
    db.prepare(`DELETE FROM telegram_links WHERE chat_id IS NULL AND ${stale}`).bind(at),
    db
      .prepare(
        `DELETE FROM telegram_links WHERE chat_id IS NOT NULL AND ${stale}
         AND NOT EXISTS (
           SELECT 1 FROM alerts
           WHERE channel = CASE telegram_links.bot WHEN 'opp' THEN 'telegram_opp' ELSE 'telegram' END
             AND address = telegram_links.chat_id
         )`,
      )
      .bind(at),
    // Accounts nobody has used in 6 months go, exactly like "Delete my data".
    db.prepare(`DELETE FROM alerts WHERE channel IN ('telegram', 'telegram_opp') AND address IN (${staleAccounts})`).bind(at),
    db.prepare(`DELETE FROM telegram_links WHERE chat_id IN (${staleAccounts})`).bind(at),
    db.prepare(`UPDATE posts SET owner_tg_id = NULL WHERE owner_tg_id IN (${staleAccounts})`).bind(at),
    db.prepare(`DELETE FROM sessions WHERE tg_id IN (${staleAccounts})`).bind(at),
    db.prepare(`DELETE FROM accounts WHERE tg_id IN (${staleAccounts})`).bind(at),
    db.prepare(`DELETE FROM sessions WHERE last_used_at <= datetime(?, '-${RETENTION.sessionDays} days')`).bind(at),
    db.prepare(`DELETE FROM login_codes WHERE created_at <= datetime(?, '-${RETENTION.loginCodeHours} hours')`).bind(at),
  ]);

  return {
    archived: archived.meta.changes,
    requests: requests.meta.changes,
    deleted: deleted.meta.changes,
    telegramLinks: unclaimed.meta.changes + stopped.meta.changes,
    accounts: accounts.meta.changes,
    sessions: sessions.meta.changes,
  };
}
