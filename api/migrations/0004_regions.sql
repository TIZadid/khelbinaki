-- Posts now say which district (and division) they are in, so keepers can follow
-- a place instead of guessing at free-text area names.
ALTER TABLE posts ADD COLUMN district TEXT NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN division TEXT NOT NULL DEFAULT '';

CREATE INDEX idx_posts_district ON posts (district, start_datetime);

-- Alerts follow regions (a district or a whole division), not free-text areas.
ALTER TABLE alerts RENAME COLUMN areas TO regions;
ALTER TABLE telegram_links RENAME COLUMN areas TO regions;
