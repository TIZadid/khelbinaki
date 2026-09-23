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
} as const;

const slotEnd = `datetime(start_datetime, '+' || COALESCE(duration_minutes, ${RETENTION.defaultSlotMinutes}) || ' minutes')`;

export type CleanupResult = { archived: number; deleted: number; requests: number; telegramLinks: number };

export async function cleanup(db: D1Database, now: Date): Promise<CleanupResult> {
  const at = now.toISOString();
  const expired = `${slotEnd} <= datetime(?, '-${RETENTION.deleteAfterHours} hours')`;
  const stale = `created_at <= datetime(?, '-${RETENTION.staleTelegramHours} hours')`;

  const [archived, requests, deleted, unclaimed, stopped] = await db.batch([
    db.prepare(`UPDATE posts SET status = 'archived' WHERE status != 'archived' AND ${slotEnd} <= datetime(?)`).bind(at),
    // Requests go first so nothing depends on foreign-key cascades being switched on.
    db.prepare(`DELETE FROM interests WHERE post_id IN (SELECT id FROM posts WHERE ${expired})`).bind(at),
    db.prepare(`DELETE FROM posts WHERE ${expired}`).bind(at),
    db.prepare(`DELETE FROM telegram_links WHERE chat_id IS NULL AND ${stale}`).bind(at),
    db
      .prepare(
        `DELETE FROM telegram_links WHERE chat_id IS NOT NULL AND ${stale}
         AND NOT EXISTS (SELECT 1 FROM alerts WHERE channel = 'telegram' AND address = telegram_links.chat_id)`,
      )
      .bind(at),
  ]);

  return {
    archived: archived.meta.changes,
    requests: requests.meta.changes,
    deleted: deleted.meta.changes,
    telegramLinks: unclaimed.meta.changes + stopped.meta.changes,
  };
}
