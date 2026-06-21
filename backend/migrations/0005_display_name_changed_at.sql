-- WellNote: track the last time a user renamed their 필명 (display name).
-- Used by PATCH /users/me/display-name to enforce a 24h cooldown.

PRAGMA foreign_keys = ON;

ALTER TABLE users ADD COLUMN display_name_changed_at TEXT;
