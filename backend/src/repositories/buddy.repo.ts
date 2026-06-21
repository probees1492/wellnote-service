import type { Follow } from "../domain/buddy";
import { ConflictError, NotFoundError } from "../lib/errors";

export interface BuddyRepo {
  /** Idempotent: returns the existing row when the pair is already linked. */
  follow(followerId: string, followeeId: string): Promise<Follow>;
  /** No-op when no row exists; otherwise returns the deleted pair. */
  unfollow(followerId: string, followeeId: string): Promise<boolean>;
  /** Whether `followerId` currently follows `followeeId`. */
  exists(followerId: string, followeeId: string): Promise<boolean>;
  /** Page of users `userId` follows, newest first. */
  listFollowing(
    userId: string,
    opts?: { cursor?: string; limit?: number },
  ): Promise<{ items: { userId: string; createdAt: string }[]; nextCursor: string | null }>;
  /** Page of users following `userId`, newest first. */
  listFollowers(
    userId: string,
    opts?: { cursor?: string; limit?: number },
  ): Promise<{ items: { userId: string; createdAt: string }[]; nextCursor: string | null }>;
}

interface FollowRow {
  follower_id: string;
  followee_id: string;
  created_at: string;
}

function mapRow(r: FollowRow): Follow {
  return {
    followerId: r.follower_id,
    followeeId: r.followee_id,
    createdAt: r.created_at,
  };
}

function isUniqueErr(e: unknown): boolean {
  const msg = (e as Error)?.message ?? String(e);
  return /UNIQUE constraint failed|D1_ERROR.*UNIQUE/i.test(msg);
}

function isCheckErr(e: unknown): boolean {
  const msg = (e as Error)?.message ?? String(e);
  return /CHECK constraint failed/i.test(msg);
}

export class D1BuddyRepo implements BuddyRepo {
  constructor(private readonly db: D1Database) {}

  async follow(followerId: string, followeeId: string): Promise<Follow> {
    if (followerId === followeeId) {
      // self-follow caught by table CHECK as well; pre-empt for a clean error.
      throw new ConflictError("Cannot follow yourself", {
        field: "followeeId",
        reason: "self",
      });
    }
    const now = new Date().toISOString();
    try {
      await this.db.batch([
        this.db
          .prepare(
            `INSERT INTO follows (follower_id, followee_id, created_at)
             VALUES (?, ?, ?)`,
          )
          .bind(followerId, followeeId, now),
        this.db
          .prepare(
            `UPDATE users SET follower_count = follower_count + 1
             WHERE id = ?`,
          )
          .bind(followeeId),
        this.db
          .prepare(
            `UPDATE users SET following_count = following_count + 1
             WHERE id = ?`,
          )
          .bind(followerId),
      ]);
    } catch (e) {
      if (isUniqueErr(e)) {
        // Already following — return the existing row idempotently.
        const row = await this.db
          .prepare(
            `SELECT follower_id, followee_id, created_at FROM follows
             WHERE follower_id = ? AND followee_id = ?`,
          )
          .bind(followerId, followeeId)
          .first<FollowRow>();
        if (row) return mapRow(row);
      }
      if (isCheckErr(e)) {
        throw new ConflictError("Cannot follow yourself", {
          field: "followeeId",
          reason: "self",
        });
      }
      throw e;
    }
    return {
      followerId,
      followeeId,
      createdAt: now,
    };
  }

  async unfollow(followerId: string, followeeId: string): Promise<boolean> {
    const existing = await this.db
      .prepare(
        `SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?`,
      )
      .bind(followerId, followeeId)
      .first();
    if (!existing) return false;
    await this.db.batch([
      this.db
        .prepare(`DELETE FROM follows WHERE follower_id = ? AND followee_id = ?`)
        .bind(followerId, followeeId),
      this.db
        .prepare(
          `UPDATE users SET follower_count = MAX(0, follower_count - 1)
           WHERE id = ?`,
        )
        .bind(followeeId),
      this.db
        .prepare(
          `UPDATE users SET following_count = MAX(0, following_count - 1)
           WHERE id = ?`,
        )
        .bind(followerId),
    ]);
    return true;
  }

  async exists(followerId: string, followeeId: string): Promise<boolean> {
    const row = await this.db
      .prepare(`SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?`)
      .bind(followerId, followeeId)
      .first();
    return !!row;
  }

  async listFollowing(
    userId: string,
    opts: { cursor?: string; limit?: number } = {},
  ): Promise<{ items: { userId: string; createdAt: string }[]; nextCursor: string | null }> {
    return this.listSide(
      "follower_id",
      "followee_id",
      userId,
      opts.cursor,
      opts.limit,
    );
  }

  async listFollowers(
    userId: string,
    opts: { cursor?: string; limit?: number } = {},
  ): Promise<{ items: { userId: string; createdAt: string }[]; nextCursor: string | null }> {
    return this.listSide(
      "followee_id",
      "follower_id",
      userId,
      opts.cursor,
      opts.limit,
    );
  }

  private async listSide(
    matchCol: "follower_id" | "followee_id",
    projectCol: "follower_id" | "followee_id",
    userId: string,
    cursor?: string,
    limit?: number,
  ): Promise<{ items: { userId: string; createdAt: string }[]; nextCursor: string | null }> {
    const lim = Math.max(1, Math.min(limit ?? 30, 100));
    const binds: unknown[] = [userId];
    let where = `${matchCol} = ?`;
    if (cursor) {
      where += " AND created_at < ?";
      binds.push(cursor);
    }
    binds.push(lim + 1);
    const sql = `SELECT ${projectCol} AS user_id, created_at FROM follows
                  WHERE ${where}
                  ORDER BY created_at DESC, ${projectCol} DESC
                  LIMIT ?`;
    const { results } = await this.db
      .prepare(sql)
      .bind(...binds)
      .all<{ user_id: string; created_at: string }>();
    const rows = results ?? [];
    const items = rows.slice(0, lim).map((r) => ({
      userId: r.user_id,
      createdAt: r.created_at,
    }));
    const hasMore = rows.length > lim;
    const nextCursor = hasMore ? items[items.length - 1].createdAt : null;
    return { items, nextCursor };
  }
}

/** In-process implementation for unit/integration tests without D1. */
export class InMemoryBuddyRepo implements BuddyRepo {
  private rows: Follow[] = [];

  async follow(followerId: string, followeeId: string): Promise<Follow> {
    if (followerId === followeeId) {
      throw new ConflictError("Cannot follow yourself", {
        field: "followeeId",
        reason: "self",
      });
    }
    const existing = this.rows.find(
      (r) => r.followerId === followerId && r.followeeId === followeeId,
    );
    if (existing) return existing;
    const row: Follow = {
      followerId,
      followeeId,
      createdAt: new Date().toISOString(),
    };
    this.rows.push(row);
    return row;
  }

  async unfollow(followerId: string, followeeId: string): Promise<boolean> {
    const before = this.rows.length;
    this.rows = this.rows.filter(
      (r) => !(r.followerId === followerId && r.followeeId === followeeId),
    );
    return this.rows.length !== before;
  }

  async exists(followerId: string, followeeId: string): Promise<boolean> {
    return this.rows.some(
      (r) => r.followerId === followerId && r.followeeId === followeeId,
    );
  }

  async listFollowing(
    userId: string,
    opts: { cursor?: string; limit?: number } = {},
  ) {
    return this.list("followerId", userId, opts.cursor, opts.limit, "followeeId");
  }
  async listFollowers(
    userId: string,
    opts: { cursor?: string; limit?: number } = {},
  ) {
    return this.list("followeeId", userId, opts.cursor, opts.limit, "followerId");
  }

  private async list(
    matchKey: "followerId" | "followeeId",
    userId: string,
    cursor: string | undefined,
    limit: number | undefined,
    projectKey: "followerId" | "followeeId",
  ) {
    const lim = Math.max(1, Math.min(limit ?? 30, 100));
    const filtered = this.rows
      .filter((r) => r[matchKey] === userId)
      .filter((r) => (cursor ? r.createdAt < cursor : true))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const sliced = filtered.slice(0, lim + 1);
    const items = sliced.slice(0, lim).map((r) => ({
      userId: r[projectKey],
      createdAt: r.createdAt,
    }));
    const nextCursor =
      sliced.length > lim ? items[items.length - 1].createdAt : null;
    return { items, nextCursor };
  }
}

// Silence the import for callers that only need the interface.
export const _NOT_FOUND = NotFoundError;
