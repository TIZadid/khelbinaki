-- Optional accounts, backed by Telegram (Part 3). A person proves who they are by
-- pressing Start in one of our bots (Telegram vouches for the user id) or by
-- typing a code a bot sent them. Nothing here is required to use the site.
CREATE TABLE accounts (
  tg_id TEXT PRIMARY KEY,                 -- Telegram user id
  name TEXT NOT NULL DEFAULT '',
  phone TEXT,                             -- 8801XXXXXXXXX, only from the bot's Share my number
  note TEXT NOT NULL DEFAULT '',
  regions TEXT NOT NULL DEFAULT '',       -- keeper places, like alerts.regions
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The browser keeps the raw session token; only its SHA-256 is stored here.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  tg_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sessions_tg ON sessions (tg_id);

-- 'link': handed to the site, claimed by /start login_<code> in a bot.
-- 'otp': sent by a bot after /login, typed on the site.
CREATE TABLE login_codes (
  code TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('link', 'otp')),
  tg_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Posts made while signed in belong to the account (so My posts works anywhere).
ALTER TABLE posts ADD COLUMN owner_tg_id TEXT;
CREATE INDEX idx_posts_owner ON posts (owner_tg_id);
