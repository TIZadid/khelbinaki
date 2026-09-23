-- Keepers who asked to hear about new games: browser push or Telegram.
CREATE TABLE alerts (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL CHECK (channel IN ('push', 'telegram')),
  address TEXT NOT NULL,          -- push endpoint URL, or Telegram chat id
  areas TEXT NOT NULL DEFAULT '', -- comma-separated lowercase areas; '' means anywhere
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (channel, address)
);

CREATE INDEX idx_alerts_channel ON alerts (channel);

-- Short-lived codes so a keeper's Telegram chat can be tied to the areas they chose.
CREATE TABLE telegram_links (
  code TEXT PRIMARY KEY,
  areas TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
