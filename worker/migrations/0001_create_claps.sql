CREATE TABLE IF NOT EXISTS article_claps (
  slug TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_article_claps_count
  ON article_claps (count DESC);
