import type { Pin, PinColor, PinVisibility } from "../domain/pin";
import type { Memo } from "../domain/memo";
import { NotFoundError } from "../lib/errors";

export interface CreatePinInput {
  id: string;
  userId: string;
  name: string;
  color?: PinColor;
  visibility?: PinVisibility;
}

export interface UpdatePinInput {
  name?: string;
  color?: PinColor;
  visibility?: PinVisibility;
}

export interface PinRepo {
  create(input: CreatePinInput): Promise<Pin>;
  findById(userId: string, pinId: string): Promise<Pin | null>;
  listByUser(userId: string): Promise<Pin[]>;
  update(userId: string, pinId: string, patch: UpdatePinInput): Promise<Pin>;
  /**
   * Delete a pin. Detaches any memos pointing at it (UPDATE pin_id = NULL)
   * before removing the row.
   */
  delete(userId: string, pinId: string): Promise<void>;
  listMemos(opts: {
    userId: string;
    pinId: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ items: Memo[]; nextCursor: string | null }>;
  /** Map pinId -> live memo count for this user (deleted_at IS NULL). */
  memoCountByPin(userId: string): Promise<Map<string, number>>;
}

interface PinRow {
  id: string;
  user_id: string;
  name: string;
  color: PinColor;
  visibility: PinVisibility;
  created_at: string;
  updated_at: string;
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

function mapPin(row: PinRow): Pin {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color,
    visibility: row.visibility,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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

export class D1PinRepo implements PinRepo {
  constructor(private readonly db: D1Database) {}

  async create(input: CreatePinInput): Promise<Pin> {
    const now = new Date().toISOString();
    const color: PinColor = input.color ?? "slate";
    const visibility: PinVisibility = input.visibility ?? "private";
    await this.db
      .prepare(
        `INSERT INTO pins (id, user_id, name, color, visibility, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(input.id, input.userId, input.name, color, visibility, now, now)
      .run();
    const row = await this.db
      .prepare(`SELECT * FROM pins WHERE id = ? AND user_id = ?`)
      .bind(input.id, input.userId)
      .first<PinRow>();
    if (!row) throw new Error("pin vanished after insert");
    return mapPin(row);
  }

  async findById(userId: string, pinId: string): Promise<Pin | null> {
    const row = await this.db
      .prepare(`SELECT * FROM pins WHERE id = ? AND user_id = ?`)
      .bind(pinId, userId)
      .first<PinRow>();
    return row ? mapPin(row) : null;
  }

  async listByUser(userId: string): Promise<Pin[]> {
    const { results } = await this.db
      .prepare(
        `SELECT * FROM pins
          WHERE user_id = ?
          ORDER BY created_at DESC, id DESC`,
      )
      .bind(userId)
      .all<PinRow>();
    return (results ?? []).map(mapPin);
  }

  async update(
    userId: string,
    pinId: string,
    patch: UpdatePinInput,
  ): Promise<Pin> {
    const sets: string[] = [];
    const values: unknown[] = [];
    if (patch.name !== undefined) {
      sets.push("name = ?");
      values.push(patch.name);
    }
    if (patch.color !== undefined) {
      sets.push("color = ?");
      values.push(patch.color);
    }
    if (patch.visibility !== undefined) {
      sets.push("visibility = ?");
      values.push(patch.visibility);
    }
    if (sets.length === 0) {
      const cur = await this.findById(userId, pinId);
      if (!cur) throw new NotFoundError("Pin");
      return cur;
    }
    const now = new Date().toISOString();
    sets.push("updated_at = ?");
    values.push(now);
    values.push(pinId, userId);
    const res = await this.db
      .prepare(
        `UPDATE pins SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`,
      )
      .bind(...values)
      .run();
    if (!res.meta?.changes) throw new NotFoundError("Pin");
    const row = await this.db
      .prepare(`SELECT * FROM pins WHERE id = ? AND user_id = ?`)
      .bind(pinId, userId)
      .first<PinRow>();
    if (!row) throw new NotFoundError("Pin");
    return mapPin(row);
  }

  async delete(userId: string, pinId: string): Promise<void> {
    // Verify ownership first so we never touch another user's data.
    const existing = await this.findById(userId, pinId);
    if (!existing) throw new NotFoundError("Pin");
    const now = new Date().toISOString();
    // Detach all memos pointing at this pin (limited to the owner).
    await this.db
      .prepare(
        `UPDATE memos
            SET pin_id = NULL, updated_at = ?
          WHERE user_id = ? AND pin_id = ?`,
      )
      .bind(now, userId, pinId)
      .run();
    await this.db
      .prepare(`DELETE FROM pins WHERE id = ? AND user_id = ?`)
      .bind(pinId, userId)
      .run();
  }

  async listMemos(opts: {
    userId: string;
    pinId: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ items: Memo[]; nextCursor: string | null }> {
    const limit = Math.max(1, Math.min(opts.limit ?? 30, 100));
    const where: string[] = [
      "user_id = ?",
      "pin_id = ?",
      "deleted_at IS NULL",
    ];
    const binds: unknown[] = [opts.userId, opts.pinId];
    if (opts.cursor) {
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

  async memoCountByPin(userId: string): Promise<Map<string, number>> {
    const { results } = await this.db
      .prepare(
        `SELECT pin_id AS pinId, COUNT(*) AS n
           FROM memos
          WHERE user_id = ?
            AND pin_id IS NOT NULL
            AND deleted_at IS NULL
          GROUP BY pin_id`,
      )
      .bind(userId)
      .all<{ pinId: string; n: number }>();
    const out = new Map<string, number>();
    for (const r of results ?? []) {
      out.set(r.pinId, Number(r.n));
    }
    return out;
  }
}
