import type { Session } from "../domain/user";
import { NotFoundError } from "../lib/errors";

export interface CreateSessionInput {
  id: string; // hash of refresh token
  userId: string;
  deviceLabel?: string | null;
  ip?: string | null;
  expiresAt: string;
}

export interface SessionRepo {
  create(input: CreateSessionInput): Promise<Session>;
  findById(id: string): Promise<Session | null>;
  touch(id: string, lastUsedAt: string): Promise<void>;
  rotate(oldId: string, newInput: CreateSessionInput): Promise<Session>;
  delete(id: string): Promise<void>;
  deleteAllForUser(userId: string): Promise<number>;
  listByUser(userId: string): Promise<Session[]>;
}

interface SessionRow {
  id: string;
  user_id: string;
  device_label: string | null;
  ip: string | null;
  expires_at: string;
  created_at: string;
  last_used_at: string;
}

function mapSession(row: SessionRow): Session {
  return {
    id: row.id,
    userId: row.user_id,
    deviceLabel: row.device_label,
    ip: row.ip,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  };
}

function kvKey(id: string): string {
  return `session:${id}`;
}

function expirationTtlSec(expiresAtIso: string): number | undefined {
  const ms = Date.parse(expiresAtIso) - Date.now();
  const sec = Math.floor(ms / 1000);
  // KV requires >=60s
  return sec > 60 ? sec : undefined;
}

export class D1KvSessionRepo implements SessionRepo {
  constructor(
    private readonly db: D1Database,
    private readonly kv: KVNamespace,
  ) {}

  async create(input: CreateSessionInput): Promise<Session> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `INSERT INTO sessions (id, user_id, device_label, ip, expires_at, created_at, last_used_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        input.id,
        input.userId,
        input.deviceLabel ?? null,
        input.ip ?? null,
        input.expiresAt,
        now,
        now,
      )
      .run();
    const session: Session = {
      id: input.id,
      userId: input.userId,
      deviceLabel: input.deviceLabel ?? null,
      ip: input.ip ?? null,
      expiresAt: input.expiresAt,
      createdAt: now,
      lastUsedAt: now,
    };
    // Mirror into KV for fast read paths.
    try {
      await this.kv.put(
        kvKey(input.id),
        JSON.stringify({ userId: input.userId, expiresAt: input.expiresAt }),
        { expirationTtl: expirationTtlSec(input.expiresAt) },
      );
    } catch {
      /* ignore */
    }
    return session;
  }

  async findById(id: string): Promise<Session | null> {
    const row = await this.db
      .prepare(`SELECT * FROM sessions WHERE id = ?`)
      .bind(id)
      .first<SessionRow>();
    if (!row) return null;
    // Expired? Treat as null.
    if (Date.parse(row.expires_at) <= Date.now()) return null;
    return mapSession(row);
  }

  async touch(id: string, lastUsedAt: string): Promise<void> {
    await this.db
      .prepare(`UPDATE sessions SET last_used_at = ? WHERE id = ?`)
      .bind(lastUsedAt, id)
      .run();
  }

  async rotate(oldId: string, newInput: CreateSessionInput): Promise<Session> {
    // Delete old, create new — in a single batch.
    const now = new Date().toISOString();
    await this.db.batch([
      this.db.prepare(`DELETE FROM sessions WHERE id = ?`).bind(oldId),
      this.db
        .prepare(
          `INSERT INTO sessions (id, user_id, device_label, ip, expires_at, created_at, last_used_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          newInput.id,
          newInput.userId,
          newInput.deviceLabel ?? null,
          newInput.ip ?? null,
          newInput.expiresAt,
          now,
          now,
        ),
    ]);
    try {
      await this.kv.delete(kvKey(oldId));
      await this.kv.put(
        kvKey(newInput.id),
        JSON.stringify({ userId: newInput.userId, expiresAt: newInput.expiresAt }),
        { expirationTtl: expirationTtlSec(newInput.expiresAt) },
      );
    } catch {
      /* ignore */
    }
    return {
      id: newInput.id,
      userId: newInput.userId,
      deviceLabel: newInput.deviceLabel ?? null,
      ip: newInput.ip ?? null,
      expiresAt: newInput.expiresAt,
      createdAt: now,
      lastUsedAt: now,
    };
  }

  async delete(id: string): Promise<void> {
    await this.db.prepare(`DELETE FROM sessions WHERE id = ?`).bind(id).run();
    try {
      await this.kv.delete(kvKey(id));
    } catch {
      /* ignore */
    }
  }

  async deleteAllForUser(userId: string): Promise<number> {
    // Read first to know KV keys to clean.
    const { results } = await this.db
      .prepare(`SELECT id FROM sessions WHERE user_id = ?`)
      .bind(userId)
      .all<{ id: string }>();
    const ids = (results ?? []).map((r) => r.id);
    if (ids.length === 0) return 0;
    await this.db
      .prepare(`DELETE FROM sessions WHERE user_id = ?`)
      .bind(userId)
      .run();
    for (const id of ids) {
      try {
        await this.kv.delete(kvKey(id));
      } catch {
        /* ignore */
      }
    }
    return ids.length;
  }

  async listByUser(userId: string): Promise<Session[]> {
    const { results } = await this.db
      .prepare(`SELECT * FROM sessions WHERE user_id = ? ORDER BY last_used_at DESC`)
      .bind(userId)
      .all<SessionRow>();
    return (results ?? []).map(mapSession);
  }
}
