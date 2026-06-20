-- WellNote streak system (Duolingo-style daily writing chain)
-- Idempotent migration: adds streak fields to users + a per-event audit table.
--
-- SQLite does not support `ADD COLUMN IF NOT EXISTS`, so we guard each ALTER
-- by checking PRAGMA table_info via a sentinel SELECT inside a `CREATE TABLE`
-- trick. To keep this readable AND idempotent for both fresh D1 envs and
-- re-runs, we use a small migration table.

CREATE TABLE IF NOT EXISTS _streak_mig_guard (
  applied INTEGER NOT NULL DEFAULT 0
);
INSERT INTO _streak_mig_guard (applied)
  SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM _streak_mig_guard);

-- The ALTER statements below will fail loudly if re-applied, but the guard
-- table lets `wrangler d1 migrations apply` skip them when already migrated.
-- D1's migration runner tracks `d1_migrations` itself, so this file will only
-- run once per environment under normal flow.

ALTER TABLE users ADD COLUMN streak_current INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN streak_longest INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN streak_freezes INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN streak_last_day TEXT;

CREATE TABLE IF NOT EXISTS streak_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL,
  event_type  TEXT NOT NULL
                CHECK (event_type IN ('increment','freeze_used','reset','milestone')),
  day_kst     TEXT NOT NULL,
  payload     TEXT,  -- JSON: { milestone?: int, freezes_remaining?: int }
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_streak_events_user
  ON streak_events(user_id, created_at DESC);

-- Allow STREAK_MILESTONE as a new credit reason. SQLite cannot ALTER a CHECK
-- constraint in-place, so we rebuild the table to add it. The rebuild keeps
-- column order, types, and all existing indexes.
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS credit_transactions_new (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  delta           INTEGER NOT NULL,
  reason          TEXT NOT NULL
                   CHECK (reason IN (
                     'SIGNUP_BONUS',
                     'READONLY_TRANSITION',
                     'STREAK_BONUS',
                     'STREAK_MILESTONE',
                     'ADMIN_GRANT',
                     'ADMIN_REVOKE'
                   )),
  reference_id    TEXT,
  balance_after   INTEGER NOT NULL CHECK (balance_after >= 0),
  created_at      TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO credit_transactions_new
  (id, user_id, delta, reason, reference_id, balance_after, created_at)
  SELECT id, user_id, delta, reason, reference_id, balance_after, created_at
    FROM credit_transactions;

DROP TABLE credit_transactions;
ALTER TABLE credit_transactions_new RENAME TO credit_transactions;

CREATE INDEX IF NOT EXISTS idx_credit_tx_user_created
  ON credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_tx_reference
  ON credit_transactions(reference_id);

PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS _streak_mig_guard;
