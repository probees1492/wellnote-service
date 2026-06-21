-- WellNote: profile avatar (사진/얼굴 등록).
-- Stores R2 object key + content-type. Plaintext (not envelope-encrypted)
-- because avatars are user-facing media, not memo bodies.

PRAGMA foreign_keys = ON;

ALTER TABLE users ADD COLUMN avatar_object_key TEXT;
ALTER TABLE users ADD COLUMN avatar_content_type TEXT;
ALTER TABLE users ADD COLUMN avatar_updated_at TEXT;
