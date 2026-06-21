-- WellNote: per-user topic preferences for daily writing-prompt filtering.
-- Stored as a JSON array of topic codes. Empty array means "all topics".

PRAGMA foreign_keys = ON;

ALTER TABLE users ADD COLUMN topic_preferences TEXT NOT NULL DEFAULT '[]';
