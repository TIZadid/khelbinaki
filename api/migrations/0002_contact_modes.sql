-- Each post picks how keepers reach the host (owner decision 2026-09-22).
ALTER TABLE posts ADD COLUMN contact_mode TEXT NOT NULL DEFAULT 'direct'
  CHECK (contact_mode IN ('direct', 'requests'));

-- "I'm interested" requests for contact_mode = 'requests'. Visible only to the host.
CREATE TABLE interests (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (post_id, phone)
);

CREATE INDEX idx_interests_post ON interests (post_id, created_at);
