-- WellNote initial schema (SQLite / D1)
-- Idempotent: uses CREATE TABLE IF NOT EXISTS
-- All timestamps are stored as ISO-8601 UTC strings (TEXT) unless stated otherwise.
-- All date_kst columns are 'YYYY-MM-DD' (KST normalized).

PRAGMA foreign_keys = ON;

-- =========================================================================
-- users: core account
-- =========================================================================
CREATE TABLE IF NOT EXISTS users (
  id                  TEXT PRIMARY KEY,                  -- UUID v7
  email               TEXT NOT NULL UNIQUE,              -- canonical lowercased email
  email_verified_at   TEXT,                              -- nullable
  display_name        TEXT NOT NULL,
  password_hash       TEXT,                              -- nullable for social-only users
  role                TEXT NOT NULL DEFAULT 'user'
                       CHECK (role IN ('user', 'admin', 'superadmin')),
  credit_balance      INTEGER NOT NULL DEFAULT 0
                       CHECK (credit_balance >= 0),      -- cached, never negative
  is_suspended        INTEGER NOT NULL DEFAULT 0
                       CHECK (is_suspended IN (0, 1)),
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- =========================================================================
-- social_identities (a.k.a. AuthMethod): provider linkage
-- =========================================================================
CREATE TABLE IF NOT EXISTS social_identities (
  id              TEXT PRIMARY KEY,                       -- UUID v7
  user_id         TEXT NOT NULL,
  provider        TEXT NOT NULL
                   CHECK (provider IN ('email', 'google', 'apple')),
  provider_sub    TEXT NOT NULL,                          -- google sub / apple sub / 'email:<user_id>'
  created_at      TEXT NOT NULL,
  UNIQUE (provider, provider_sub),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_social_identities_user_id
  ON social_identities(user_id);

-- =========================================================================
-- sessions: refresh-token registry (also mirrored in KV for fast read)
-- =========================================================================
CREATE TABLE IF NOT EXISTS sessions (
  id                  TEXT PRIMARY KEY,                  -- sha256 hash of refresh token
  user_id             TEXT NOT NULL,
  device_label        TEXT,                              -- e.g. 'Chrome on macOS'
  ip                  TEXT,                              -- first-issued IP
  expires_at          TEXT NOT NULL,
  created_at          TEXT NOT NULL,
  last_used_at        TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- =========================================================================
-- memos: one memo per user per KST date (unique active row)
-- =========================================================================
CREATE TABLE IF NOT EXISTS memos (
  id                  TEXT PRIMARY KEY,                  -- UUID v7
  user_id             TEXT NOT NULL,
  date_kst            TEXT NOT NULL,                     -- 'YYYY-MM-DD' (KST)
  title               TEXT NOT NULL DEFAULT '',          -- first line up to 80 chars
  char_count          INTEGER NOT NULL DEFAULT 0
                       CHECK (char_count >= 0 AND char_count <= 100000),
  r2_object_key       TEXT NOT NULL,                     -- 'users/{userId}/memos/{memoId}.md.enc'
  encrypted_dek       TEXT NOT NULL,                     -- base64(wrap(DEK, KEK))
  dek_algo            TEXT NOT NULL DEFAULT 'aes-256-gcm'
                       CHECK (dek_algo IN ('aes-256-gcm')),
  iv                  TEXT NOT NULL,                     -- base64 IV for the body
  body_sha256         TEXT,                              -- integrity hash of plaintext
  is_readonly         INTEGER NOT NULL DEFAULT 0
                       CHECK (is_readonly IN (0, 1)),
  readonly_at         TEXT,                              -- nullable
  deleted_at          TEXT,                              -- soft delete
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- One active memo per user per KST date (soft-deleted rows allowed in addition)
CREATE UNIQUE INDEX IF NOT EXISTS uq_memos_user_date_active
  ON memos(user_id, date_kst) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_memos_user_date
  ON memos(user_id, date_kst);

-- For activity grid 364-day range queries
CREATE INDEX IF NOT EXISTS idx_memos_user_date_range
  ON memos(user_id, date_kst, char_count) WHERE deleted_at IS NULL;

-- For readonly cron sweeps
CREATE INDEX IF NOT EXISTS idx_memos_readonly_pending
  ON memos(date_kst, is_readonly) WHERE deleted_at IS NULL;

-- =========================================================================
-- memo_search_index: per-user plaintext token store for search
-- =========================================================================
CREATE TABLE IF NOT EXISTS memo_search_index (
  memo_id     TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,                              -- denormalized for filter
  tokens      TEXT NOT NULL DEFAULT '',                   -- space-separated lowercase tokens
  updated_at  TEXT NOT NULL,
  FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memo_search_user
  ON memo_search_index(user_id);

-- Optional FTS5 virtual table (D1 supports FTS5). Created if not present.
CREATE VIRTUAL TABLE IF NOT EXISTS memo_search_fts USING fts5(
  memo_id UNINDEXED,
  user_id UNINDEXED,
  tokens,
  tokenize = 'unicode61'
);

-- =========================================================================
-- credit_transactions: append-only ledger; source of truth for balance
-- =========================================================================
CREATE TABLE IF NOT EXISTS credit_transactions (
  id              TEXT PRIMARY KEY,                       -- UUID v7
  user_id         TEXT NOT NULL,
  delta           INTEGER NOT NULL,                       -- positive or negative
  reason          TEXT NOT NULL
                   CHECK (reason IN (
                     'SIGNUP_BONUS',
                     'READONLY_TRANSITION',
                     'STREAK_BONUS',
                     'ADMIN_GRANT',
                     'ADMIN_REVOKE'
                   )),
  reference_id    TEXT,                                   -- memo_id or admin_action_id
  balance_after   INTEGER NOT NULL CHECK (balance_after >= 0),
  created_at      TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_credit_tx_user_created
  ON credit_transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_tx_reference
  ON credit_transactions(reference_id);

-- =========================================================================
-- admin_actions: audit log
-- =========================================================================
CREATE TABLE IF NOT EXISTS admin_actions (
  id                TEXT PRIMARY KEY,                     -- UUID v7
  actor_user_id     TEXT NOT NULL,                        -- admin/superadmin
  target_user_id    TEXT,                                 -- nullable for system-wide actions
  action_type       TEXT NOT NULL
                     CHECK (action_type IN (
                       'GRANT_CREDIT',
                       'REVOKE_CREDIT',
                       'FORCE_READONLY',
                       'SUSPEND_USER',
                       'UNSUSPEND_USER',
                       'KICK_SESSIONS'
                     )),
  payload           TEXT,                                  -- JSON string
  reason            TEXT NOT NULL
                     CHECK (length(reason) BETWEEN 10 AND 200),
  created_at        TEXT NOT NULL,
  FOREIGN KEY (actor_user_id)  REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_actor
  ON admin_actions(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target
  ON admin_actions(target_user_id, created_at DESC);

-- =========================================================================
-- password_reset_tokens
-- =========================================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash    TEXT PRIMARY KEY,                          -- sha256 of raw token
  user_id       TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  used_at       TEXT,
  created_at    TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pwd_reset_user
  ON password_reset_tokens(user_id);

-- =========================================================================
-- email_verification_tokens
-- =========================================================================
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  token_hash    TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  used_at       TEXT,
  created_at    TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_verify_user
  ON email_verification_tokens(user_id);

-- =========================================================================
-- daily_activity (denormalized cache for fast 52w grid reads)
--   one row per (user_id, date_kst) — kept in sync with memos
-- =========================================================================
CREATE TABLE IF NOT EXISTS daily_activity (
  user_id     TEXT NOT NULL,
  date_kst    TEXT NOT NULL,
  char_count  INTEGER NOT NULL DEFAULT 0 CHECK (char_count >= 0),
  memo_id     TEXT,
  level       INTEGER NOT NULL DEFAULT 0
              CHECK (level BETWEEN 0 AND 4),
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (user_id, date_kst),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_daily_activity_user_range
  ON daily_activity(user_id, date_kst DESC);
