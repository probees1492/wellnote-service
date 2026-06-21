-- WellNote: 버디(follow) graph + visibility.
--
-- A row in `follows` means follower_id has subscribed to followee_id; reading
-- access for buddy content keys off this table.
--
-- The cached `follower_count` / `following_count` columns avoid an N+1
-- COUNT(*) on every profile view. They MUST be maintained transactionally
-- whenever a row is added or removed.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS follows (
  follower_id  TEXT NOT NULL,
  followee_id  TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  PRIMARY KEY (follower_id, followee_id),
  FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (followee_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (follower_id <> followee_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_followee
  ON follows(followee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follows_follower
  ON follows(follower_id, created_at DESC);

-- Denormalised counts to keep profile reads O(1).
ALTER TABLE users ADD COLUMN follower_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN following_count INTEGER NOT NULL DEFAULT 0;

-- Public by default — spec says 내가 팔로잉 하고 있는 버디 목록은 기본 공개.
ALTER TABLE users ADD COLUMN following_visibility TEXT NOT NULL DEFAULT 'public';
