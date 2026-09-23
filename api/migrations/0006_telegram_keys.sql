-- A Telegram link code is no longer thrown away once used: it becomes the keeper's
-- private key (kept in their browser) to that chat's alerts, so the site can show
-- whether Telegram is connected, change its places, or turn it off. No login needed.
ALTER TABLE telegram_links ADD COLUMN chat_id TEXT;
