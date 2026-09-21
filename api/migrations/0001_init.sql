CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  listing_type TEXT NOT NULL DEFAULT 'gk_needed'
    CHECK (listing_type IN ('gk_needed', 'opponent_needed')),
  host_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  area TEXT NOT NULL,
  turf_name TEXT,
  lat REAL,
  lng REAL,
  start_datetime TEXT NOT NULL, -- UTC ISO 8601 from Date.toISOString()
  duration_minutes INTEGER,
  cost_per_head INTEGER,
  slots_needed INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'filled', 'archived')),
  edit_token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_posts_feed ON posts (status, start_datetime);
