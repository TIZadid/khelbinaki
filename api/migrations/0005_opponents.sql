-- Opponent Lagbe (owner request 2026-09-23): teams post that they need a team to play.
-- Both listing types say how many a side the match is; opponent posts also name the team.
-- For opponent posts cost_per_head holds the cost per team (their share of the turf).
ALTER TABLE posts ADD COLUMN players_per_side INTEGER;
ALTER TABLE posts ADD COLUMN team_name TEXT;

CREATE INDEX idx_posts_type_feed ON posts (listing_type, start_datetime);
