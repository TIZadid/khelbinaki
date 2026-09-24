-- Alerts say which boards they want (GK Lagbe, Opponent Lagbe or both), and the
-- Opponent Lagbe bot gets its own channel. SQLite can't change a CHECK in place,
-- so the table is rebuilt; every existing alert was a GK alert.
CREATE TABLE alerts_new (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL CHECK (channel IN ('push', 'telegram', 'telegram_opp')),
  address TEXT NOT NULL,
  regions TEXT NOT NULL DEFAULT '',
  boards TEXT NOT NULL DEFAULT 'gk_needed',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (channel, address)
);
INSERT INTO alerts_new (id, channel, address, regions, boards, created_at)
  SELECT id, channel, address, regions, 'gk_needed', created_at FROM alerts;
DROP TABLE alerts;
ALTER TABLE alerts_new RENAME TO alerts;
CREATE INDEX idx_alerts_channel ON alerts (channel);

-- Which bot a link code belongs to: 'gk' (@gklagbebot) or 'opp' (@opponentlagbebot).
ALTER TABLE telegram_links ADD COLUMN bot TEXT NOT NULL DEFAULT 'gk';
