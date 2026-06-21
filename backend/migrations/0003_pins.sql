-- WellNote pin system (cork-board pushpin metaphor)
-- Idempotent migration: adds the `pins` table and `memos.pin_id` column.
--
-- Concept:
--   - A pin is a user-owned classification bucket for memos.
--   - A memo belongs to 0 or 1 pin (NOT m:n).
--   - Pins carry a name, a color enum, and a visibility flag (private/public).
--   - "public" visibility is metadata only — friend-share features will use it
--     later. The backend never exposes a pin to a different user yet.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS pins (
  id          TEXT PRIMARY KEY,                       -- UUID-ish id
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL
                CHECK (length(name) BETWEEN 1 AND 40),
  color       TEXT NOT NULL DEFAULT 'slate'
                CHECK (color IN ('slate','yellow','red','green','blue')),
  visibility  TEXT NOT NULL DEFAULT 'private'
                CHECK (visibility IN ('private','public')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pins_user
  ON pins(user_id, created_at DESC);

-- =========================================================================
-- memos.pin_id: nullable foreign key to pins(id).
-- SQLite does not support `ADD COLUMN IF NOT EXISTS`, so the migration is
-- guarded by D1's migration runner (it tracks `d1_migrations` and applies
-- each file exactly once per environment).
-- ON DELETE behavior is handled in application code (D1PinRepo.delete first
-- UPDATEs memos.pin_id = NULL, then DELETEs the pin row) to keep the FK
-- declaration minimal and portable.
-- =========================================================================
ALTER TABLE memos ADD COLUMN pin_id TEXT REFERENCES pins(id);

CREATE INDEX IF NOT EXISTS idx_memos_pin
  ON memos(pin_id);
