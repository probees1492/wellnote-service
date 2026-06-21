-- WellNote: enforce case-insensitive uniqueness for `display_name` (필명).
-- Existing rows are de-duplicated by appending a short id-suffix so the
-- migration is safe to re-run against dev/stage/prod data.

PRAGMA foreign_keys = ON;

-- Step 1: rename collisions. ROW_NUMBER() over LOWER(display_name) keeps the
-- earliest-created row untouched and tags later collisions with the last 4
-- chars of their user id (UUID-style, unique).
UPDATE users
SET display_name = display_name || '_' || substr(id, length(id) - 3, 4)
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY LOWER(display_name)
        ORDER BY created_at, id
      ) AS rn
    FROM users
  )
  WHERE rn > 1
);

-- Step 2: case-insensitive unique constraint via expression index.
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_display_name_lower
  ON users(LOWER(display_name));
