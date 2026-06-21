import type { Memo, ActivityCell } from "../domain/memo";
import { activityLevelFromCharCount } from "../domain/memo";
import { ConflictError, NotFoundError } from "../lib/errors";

export interface CreateMemoInput {
  id: string;
  userId: string;
  dateKst: string;
  r2ObjectKey: string;
  encryptedDek: string;
  iv: string;
}

export interface UpdateMemoInput {
  title?: string;
  charCount?: number;
  bodySha256?: string | null;
  encryptedDek?: string;
  iv?: string;
  expectedUpdatedAt?: string; // for optimistic lock
}

export interface MemoRepo {
  create(input: CreateMemoInput): Promise<Memo>;
  findById(id: string): Promise<Memo | null>;
  findByUserAndDate(userId: string, dateKst: string): Promise<Memo | null>;
  update(id: string, patch: UpdateMemoInput): Promise<Memo>;
  softDelete(id: string): Promise<void>;
  list(opts: {
    userId: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ items: Memo[]; nextCursor: string | null }>;

  /** Mark a memo as readonly atomically. Returns updated memo. */
  setReadonly(id: string, readonlyAt: string): Promise<Memo>;

  /** Used by cron to find yesterday's memos still editable. */
  findPendingReadonlyForDate(dateKst: string): Promise<Memo[]>;

  /** Activity grid query: aggregated cells for [from, to] KST inclusive. */
  activityCells(userId: string, from: string, to: string): Promise<ActivityCell[]>;

  /** Replace search tokens for a memo. */
  upsertSearchTokens(memoId: string, userId: string, tokens: string[]): Promise<void>;

  /** Search memos by tokens within optional date range. */
  search(opts: {
    userId: string;
    query: string;
    from?: string;
    to?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ items: Memo[]; nextCursor: string | null }>;

  /** Set or clear the pin a memo belongs to. Returns the updated memo. */
  setPin(opts: {
    userId: string;
    memoId: string;
    pinId: string | null;
  }): Promise<Memo>;
}

interface MemoRow {
  id: string;
  user_id: string;
  date_kst: string;
  title: string;
  char_count: number;
  r2_object_key: string;
  encrypted_dek: string;
  dek_algo: "aes-256-gcm";
  iv: string;
  body_sha256: string | null;
  is_readonly: number;
  readonly_at: string | null;
  deleted_at: string | null;
  pin_id: string | null;
  created_at: string;
  updated_at: string;
}

function mapMemo(row: MemoRow): Memo {
  return {
    id: row.id,
    userId: row.user_id,
    dateKst: row.date_kst,
    title: row.title,
    charCount: row.char_count,
    r2ObjectKey: row.r2_object_key,
    encryptedDek: row.encrypted_dek,
    dekAlgo: row.dek_algo,
    iv: row.iv,
    bodySha256: row.body_sha256,
    isReadonly: row.is_readonly === 1,
    readonlyAt: row.readonly_at,
    deletedAt: row.deleted_at,
    pinId: row.pin_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isUniqueConstraintError(e: unknown): boolean {
  const msg = (e as Error)?.message ?? String(e);
  return /UNIQUE constraint failed|D1_ERROR.*UNIQUE/i.test(msg);
}

export class D1MemoRepo implements MemoRepo {
  constructor(private readonly db: D1Database) {}

  async create(input: CreateMemoInput): Promise<Memo> {
    const now = new Date().toISOString();
    try {
      await this.db
        .prepare(
          `INSERT INTO memos (
             id, user_id, date_kst, title, char_count,
             r2_object_key, encrypted_dek, dek_algo, iv, body_sha256,
             is_readonly, readonly_at, deleted_at, created_at, updated_at
           ) VALUES (?, ?, ?, '', 0, ?, ?, 'aes-256-gcm', ?, NULL, 0, NULL, NULL, ?, ?)`,
        )
        .bind(
          input.id,
          input.userId,
          input.dateKst,
          input.r2ObjectKey,
          input.encryptedDek,
          input.iv,
          now,
          now,
        )
        .run();
    } catch (e) {
      if (isUniqueConstraintError(e)) {
        // Active memo for this user/date already exists — return it.
        const existing = await this.findByUserAndDate(input.userId, input.dateKst);
        if (existing) return existing;
        throw new ConflictError("Memo already exists for this date");
      }
      throw e;
    }
    const row = await this.db
      .prepare(`SELECT * FROM memos WHERE id = ?`)
      .bind(input.id)
      .first<MemoRow>();
    if (!row) throw new Error("memo vanished after insert");
    // Also seed an empty daily_activity row.
    await this.upsertDailyActivity(input.userId, input.dateKst, 0, input.id);
    return mapMemo(row);
  }

  async findById(id: string): Promise<Memo | null> {
    const row = await this.db
      .prepare(`SELECT * FROM memos WHERE id = ?`)
      .bind(id)
      .first<MemoRow>();
    return row ? mapMemo(row) : null;
  }

  async findByUserAndDate(userId: string, dateKst: string): Promise<Memo | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM memos
          WHERE user_id = ? AND date_kst = ? AND deleted_at IS NULL
          LIMIT 1`,
      )
      .bind(userId, dateKst)
      .first<MemoRow>();
    return row ? mapMemo(row) : null;
  }

  async update(id: string, patch: UpdateMemoInput): Promise<Memo> {
    const sets: string[] = [];
    const values: unknown[] = [];
    if (patch.title !== undefined) {
      sets.push("title = ?");
      values.push(patch.title);
    }
    if (patch.charCount !== undefined) {
      sets.push("char_count = ?");
      values.push(patch.charCount);
    }
    if (patch.bodySha256 !== undefined) {
      sets.push("body_sha256 = ?");
      values.push(patch.bodySha256);
    }
    if (patch.encryptedDek !== undefined) {
      sets.push("encrypted_dek = ?");
      values.push(patch.encryptedDek);
    }
    if (patch.iv !== undefined) {
      sets.push("iv = ?");
      values.push(patch.iv);
    }
    const now = new Date().toISOString();
    sets.push("updated_at = ?");
    values.push(now);

    const where: string[] = ["id = ?", "deleted_at IS NULL"];
    values.push(id);
    if (patch.expectedUpdatedAt) {
      where.push("updated_at = ?");
      values.push(patch.expectedUpdatedAt);
    }

    const res = await this.db
      .prepare(`UPDATE memos SET ${sets.join(", ")} WHERE ${where.join(" AND ")}`)
      .bind(...values)
      .run();
    if (!res.meta?.changes) {
      // Either not found or stale expectedUpdatedAt
      const existing = await this.findById(id);
      if (!existing) throw new NotFoundError("Memo");
      if (patch.expectedUpdatedAt) {
        throw new ConflictError("Memo was updated concurrently");
      }
      // No-op update on a present row — treat as success.
      return existing;
    }
    const row = await this.db
      .prepare(`SELECT * FROM memos WHERE id = ?`)
      .bind(id)
      .first<MemoRow>();
    if (!row) throw new NotFoundError("Memo");
    // Keep daily_activity in sync if char_count changed.
    if (patch.charCount !== undefined) {
      await this.upsertDailyActivity(row.user_id, row.date_kst, row.char_count, row.id);
    }
    return mapMemo(row);
  }

  async softDelete(id: string): Promise<void> {
    const now = new Date().toISOString();
    // Look up first to know date / user for daily_activity cleanup.
    const cur = await this.findById(id);
    if (!cur) throw new NotFoundError("Memo");
    const res = await this.db
      .prepare(
        `UPDATE memos
            SET deleted_at = ?, updated_at = ?
          WHERE id = ? AND deleted_at IS NULL`,
      )
      .bind(now, now, id)
      .run();
    if (!res.meta?.changes) return;
    // Reset daily_activity for that user/date back to 0.
    await this.db
      .prepare(
        `UPDATE daily_activity
            SET char_count = 0, memo_id = NULL, level = 0, updated_at = ?
          WHERE user_id = ? AND date_kst = ?`,
      )
      .bind(now, cur.userId, cur.dateKst)
      .run();
  }

  async list(opts: {
    userId: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ items: Memo[]; nextCursor: string | null }> {
    const limit = Math.max(1, Math.min(opts.limit ?? 30, 100));
    const where: string[] = ["user_id = ?", "deleted_at IS NULL"];
    const binds: unknown[] = [opts.userId];
    if (opts.cursor) {
      // Cursor format: dateKst-id (ISO sortable). Use simple date cursor.
      where.push("date_kst < ?");
      binds.push(opts.cursor);
    }
    binds.push(limit + 1);
    const { results } = await this.db
      .prepare(
        `SELECT * FROM memos
          WHERE ${where.join(" AND ")}
          ORDER BY date_kst DESC, id DESC
          LIMIT ?`,
      )
      .bind(...binds)
      .all<MemoRow>();
    const rows = results ?? [];
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map(mapMemo);
    const nextCursor = hasMore ? items[items.length - 1].dateKst : null;
    return { items, nextCursor };
  }

  async setReadonly(id: string, readonlyAt: string): Promise<Memo> {
    const res = await this.db
      .prepare(
        `UPDATE memos
            SET is_readonly = 1, readonly_at = ?, updated_at = ?
          WHERE id = ? AND deleted_at IS NULL`,
      )
      .bind(readonlyAt, readonlyAt, id)
      .run();
    if (!res.meta?.changes) {
      const cur = await this.findById(id);
      if (!cur) throw new NotFoundError("Memo");
      return cur;
    }
    const row = await this.db
      .prepare(`SELECT * FROM memos WHERE id = ?`)
      .bind(id)
      .first<MemoRow>();
    if (!row) throw new NotFoundError("Memo");
    return mapMemo(row);
  }

  async findPendingReadonlyForDate(dateKst: string): Promise<Memo[]> {
    const { results } = await this.db
      .prepare(
        `SELECT * FROM memos
          WHERE date_kst = ? AND is_readonly = 0 AND deleted_at IS NULL
          ORDER BY user_id ASC, id ASC`,
      )
      .bind(dateKst)
      .all<MemoRow>();
    return (results ?? []).map(mapMemo);
  }

  async activityCells(
    userId: string,
    from: string,
    to: string,
  ): Promise<ActivityCell[]> {
    // Prefer daily_activity cache; fallback to memos aggregation.
    const { results } = await this.db
      .prepare(
        `SELECT date_kst AS date, char_count AS charCount, memo_id AS memoId
           FROM daily_activity
          WHERE user_id = ? AND date_kst BETWEEN ? AND ?
          ORDER BY date_kst ASC`,
      )
      .bind(userId, from, to)
      .all<{ date: string; charCount: number; memoId: string | null }>();
    const cached = results ?? [];
    if (cached.length > 0) {
      return cached.map((r) => ({
        date: r.date,
        charCount: r.charCount,
        memoId: r.memoId ?? null,
        level: activityLevelFromCharCount(r.charCount),
      }));
    }
    // Fallback: derive from memos directly.
    const { results: memoRows } = await this.db
      .prepare(
        `SELECT date_kst AS date, char_count AS charCount, id AS memoId
           FROM memos
          WHERE user_id = ?
            AND date_kst BETWEEN ? AND ?
            AND deleted_at IS NULL`,
      )
      .bind(userId, from, to)
      .all<{ date: string; charCount: number; memoId: string }>();
    return (memoRows ?? []).map((r) => ({
      date: r.date,
      charCount: r.charCount,
      memoId: r.memoId,
      level: activityLevelFromCharCount(r.charCount),
    }));
  }

  async upsertSearchTokens(
    memoId: string,
    userId: string,
    tokens: string[],
  ): Promise<void> {
    const now = new Date().toISOString();
    const tokenStr = tokens.join(" ");
    await this.db
      .prepare(
        `INSERT INTO memo_search_index (memo_id, user_id, tokens, updated_at)
           VALUES (?, ?, ?, ?)
         ON CONFLICT(memo_id) DO UPDATE SET
           tokens = excluded.tokens,
           updated_at = excluded.updated_at`,
      )
      .bind(memoId, userId, tokenStr, now)
      .run();
  }

  async search(opts: {
    userId: string;
    query: string;
    from?: string;
    to?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ items: Memo[]; nextCursor: string | null }> {
    const limit = Math.max(1, Math.min(opts.limit ?? 20, 100));
    const q = opts.query.trim().toLowerCase();
    if (!q) {
      // Empty query: just list within range.
      return this.list({ userId: opts.userId, limit });
    }
    const where: string[] = [
      "m.user_id = ?",
      "m.deleted_at IS NULL",
      "(LOWER(m.title) LIKE ? OR si.tokens LIKE ?)",
    ];
    const binds: unknown[] = [opts.userId, `%${q}%`, `%${q}%`];
    if (opts.from) {
      where.push("m.date_kst >= ?");
      binds.push(opts.from);
    }
    if (opts.to) {
      where.push("m.date_kst <= ?");
      binds.push(opts.to);
    }
    if (opts.cursor) {
      where.push("m.date_kst < ?");
      binds.push(opts.cursor);
    }
    binds.push(limit + 1);
    const { results } = await this.db
      .prepare(
        `SELECT m.* FROM memos m
           LEFT JOIN memo_search_index si ON si.memo_id = m.id
          WHERE ${where.join(" AND ")}
          ORDER BY m.date_kst DESC, m.id DESC
          LIMIT ?`,
      )
      .bind(...binds)
      .all<MemoRow>();
    const rows = results ?? [];
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map(mapMemo);
    const nextCursor = hasMore ? items[items.length - 1].dateKst : null;
    return { items, nextCursor };
  }

  async setPin(opts: {
    userId: string;
    memoId: string;
    pinId: string | null;
  }): Promise<Memo> {
    const now = new Date().toISOString();
    const res = await this.db
      .prepare(
        `UPDATE memos
            SET pin_id = ?, updated_at = ?
          WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      )
      .bind(opts.pinId, now, opts.memoId, opts.userId)
      .run();
    if (!res.meta?.changes) {
      throw new NotFoundError("Memo");
    }
    const row = await this.db
      .prepare(`SELECT * FROM memos WHERE id = ?`)
      .bind(opts.memoId)
      .first<MemoRow>();
    if (!row) throw new NotFoundError("Memo");
    return mapMemo(row);
  }

  private async upsertDailyActivity(
    userId: string,
    dateKst: string,
    charCount: number,
    memoId: string,
  ): Promise<void> {
    const now = new Date().toISOString();
    const level = activityLevelFromCharCount(charCount);
    await this.db
      .prepare(
        `INSERT INTO daily_activity (user_id, date_kst, char_count, memo_id, level, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, date_kst) DO UPDATE SET
            char_count = excluded.char_count,
            memo_id = excluded.memo_id,
            level = excluded.level,
            updated_at = excluded.updated_at`,
      )
      .bind(userId, dateKst, charCount, memoId, level, now)
      .run();
  }
}
