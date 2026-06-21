-- WellNote: emoji reactions + short comments on memos.
--
-- Reactions: 1 row per (memo, user, emoji). The UNIQUE constraint lets us
-- toggle by attempting an INSERT and falling back to DELETE on conflict.
--
-- Comments: hard-capped at 20 chars (spec). Per-memo timeline.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS memo_reactions (
  id          TEXT PRIMARY KEY,
  memo_id     TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  emoji       TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  UNIQUE (memo_id, user_id, emoji),
  FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reactions_memo
  ON memo_reactions(memo_id, created_at DESC);

CREATE TABLE IF NOT EXISTS memo_comments (
  id          TEXT PRIMARY KEY,
  memo_id     TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  body        TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 20),
  created_at  TEXT NOT NULL,
  FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comments_memo
  ON memo_comments(memo_id, created_at DESC);
