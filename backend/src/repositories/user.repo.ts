import type { User, UserRole, SocialIdentity, SocialProvider } from "../domain/user";
import { ConflictError, NotFoundError } from "../lib/errors";

export interface CreateUserInput {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string | null;
  role?: UserRole;
  creditBalance?: number;
}

export interface UpdateUserInput {
  displayName?: string;
  emailVerifiedAt?: string | null;
  passwordHash?: string | null;
  role?: UserRole;
  isSuspended?: boolean;
}

export interface UpdateStreakInput {
  streakCurrent?: number;
  streakLongest?: number;
  streakFreezes?: number;
  streakLastDay?: string | null;
}

export interface UserRepo {
  create(input: CreateUserInput): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  update(id: string, patch: UpdateUserInput): Promise<User>;
  adjustCreditBalance(id: string, delta: number): Promise<number>;
  updateStreak(id: string, patch: UpdateStreakInput): Promise<User>;
  list(opts: {
    cursor?: string;
    limit?: number;
    query?: string;
    role?: UserRole;
    isSuspended?: boolean;
  }): Promise<{ items: User[]; nextCursor: string | null }>;

  addSocialIdentity(input: {
    id: string;
    userId: string;
    provider: SocialProvider;
    providerSub: string;
  }): Promise<SocialIdentity>;
  findSocialIdentity(
    provider: SocialProvider,
    providerSub: string,
  ): Promise<SocialIdentity | null>;
  listSocialIdentities(userId: string): Promise<SocialIdentity[]>;
}

/** Row shape returned from D1 `users` table. */
interface UserRow {
  id: string;
  email: string;
  email_verified_at: string | null;
  display_name: string;
  password_hash: string | null;
  role: UserRole;
  credit_balance: number;
  is_suspended: number;
  created_at: string;
  updated_at: string;
  streak_current?: number | null;
  streak_longest?: number | null;
  streak_freezes?: number | null;
  streak_last_day?: string | null;
}

interface SocialRow {
  id: string;
  user_id: string;
  provider: SocialProvider;
  provider_sub: string;
  created_at: string;
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    emailVerifiedAt: row.email_verified_at,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    role: row.role,
    creditBalance: row.credit_balance,
    isSuspended: row.is_suspended === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    streakCurrent: row.streak_current ?? 0,
    streakLongest: row.streak_longest ?? 0,
    streakFreezes: row.streak_freezes ?? 1,
    streakLastDay: row.streak_last_day ?? null,
  };
}

function mapSocial(row: SocialRow): SocialIdentity {
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    providerSub: row.provider_sub,
    createdAt: row.created_at,
  };
}

function isUniqueConstraintError(e: unknown): boolean {
  const msg = (e as Error)?.message ?? String(e);
  return /UNIQUE constraint failed|D1_ERROR.*UNIQUE/i.test(msg);
}

export class D1UserRepo implements UserRepo {
  constructor(private readonly db: D1Database) {}

  async create(input: CreateUserInput): Promise<User> {
    const now = new Date().toISOString();
    const email = input.email.toLowerCase();
    const role: UserRole = input.role ?? "user";
    const creditBalance = input.creditBalance ?? 0;
    try {
      await this.db
        .prepare(
          `INSERT INTO users (id, email, email_verified_at, display_name, password_hash, role, credit_balance, is_suspended, created_at, updated_at)
           VALUES (?, ?, NULL, ?, ?, ?, ?, 0, ?, ?)`,
        )
        .bind(
          input.id,
          email,
          input.displayName,
          input.passwordHash,
          role,
          creditBalance,
          now,
          now,
        )
        .run();
    } catch (e) {
      if (isUniqueConstraintError(e)) {
        throw new ConflictError("Email already in use");
      }
      throw e;
    }
    const row = await this.db
      .prepare(`SELECT * FROM users WHERE id = ?`)
      .bind(input.id)
      .first<UserRow>();
    if (!row) throw new Error("user vanished after insert");
    return mapUser(row);
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.db
      .prepare(`SELECT * FROM users WHERE id = ?`)
      .bind(id)
      .first<UserRow>();
    return row ? mapUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.db
      .prepare(`SELECT * FROM users WHERE email = ?`)
      .bind(email.toLowerCase())
      .first<UserRow>();
    return row ? mapUser(row) : null;
  }

  async update(id: string, patch: UpdateUserInput): Promise<User> {
    const sets: string[] = [];
    const values: unknown[] = [];
    if (patch.displayName !== undefined) {
      sets.push("display_name = ?");
      values.push(patch.displayName);
    }
    if (patch.emailVerifiedAt !== undefined) {
      sets.push("email_verified_at = ?");
      values.push(patch.emailVerifiedAt);
    }
    if (patch.passwordHash !== undefined) {
      sets.push("password_hash = ?");
      values.push(patch.passwordHash);
    }
    if (patch.role !== undefined) {
      sets.push("role = ?");
      values.push(patch.role);
    }
    if (patch.isSuspended !== undefined) {
      sets.push("is_suspended = ?");
      values.push(patch.isSuspended ? 1 : 0);
    }
    if (sets.length === 0) {
      const cur = await this.findById(id);
      if (!cur) throw new NotFoundError("User");
      return cur;
    }
    const now = new Date().toISOString();
    sets.push("updated_at = ?");
    values.push(now);
    values.push(id);
    const res = await this.db
      .prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
    if (!res.meta?.changes) throw new NotFoundError("User");
    const row = await this.db
      .prepare(`SELECT * FROM users WHERE id = ?`)
      .bind(id)
      .first<UserRow>();
    if (!row) throw new NotFoundError("User");
    return mapUser(row);
  }

  async updateStreak(id: string, patch: UpdateStreakInput): Promise<User> {
    const sets: string[] = [];
    const values: unknown[] = [];
    if (patch.streakCurrent !== undefined) {
      sets.push("streak_current = ?");
      values.push(patch.streakCurrent);
    }
    if (patch.streakLongest !== undefined) {
      sets.push("streak_longest = ?");
      values.push(patch.streakLongest);
    }
    if (patch.streakFreezes !== undefined) {
      sets.push("streak_freezes = ?");
      values.push(patch.streakFreezes);
    }
    if (patch.streakLastDay !== undefined) {
      sets.push("streak_last_day = ?");
      values.push(patch.streakLastDay);
    }
    if (sets.length === 0) {
      const cur = await this.findById(id);
      if (!cur) throw new NotFoundError("User");
      return cur;
    }
    const now = new Date().toISOString();
    sets.push("updated_at = ?");
    values.push(now);
    values.push(id);
    const res = await this.db
      .prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
    if (!res.meta?.changes) throw new NotFoundError("User");
    const row = await this.db
      .prepare(`SELECT * FROM users WHERE id = ?`)
      .bind(id)
      .first<UserRow>();
    if (!row) throw new NotFoundError("User");
    return mapUser(row);
  }

  async adjustCreditBalance(id: string, delta: number): Promise<number> {
    // Atomic clamp at 0 via SQL expression.
    await this.db
      .prepare(
        `UPDATE users
           SET credit_balance = MAX(0, credit_balance + ?),
               updated_at = ?
         WHERE id = ?`,
      )
      .bind(delta, new Date().toISOString(), id)
      .run();
    const row = await this.db
      .prepare(`SELECT credit_balance FROM users WHERE id = ?`)
      .bind(id)
      .first<{ credit_balance: number }>();
    if (!row) throw new NotFoundError("User");
    return row.credit_balance;
  }

  async list(opts: {
    cursor?: string;
    limit?: number;
    query?: string;
    role?: UserRole;
    isSuspended?: boolean;
  }): Promise<{ items: User[]; nextCursor: string | null }> {
    const limit = Math.max(1, Math.min(opts.limit ?? 30, 100));
    const where: string[] = [];
    const binds: unknown[] = [];
    if (opts.query) {
      where.push("(email LIKE ? OR display_name LIKE ?)");
      binds.push(`%${opts.query}%`, `%${opts.query}%`);
    }
    if (opts.role) {
      where.push("role = ?");
      binds.push(opts.role);
    }
    if (opts.isSuspended !== undefined) {
      where.push("is_suspended = ?");
      binds.push(opts.isSuspended ? 1 : 0);
    }
    if (opts.cursor) {
      where.push("created_at < ?");
      binds.push(opts.cursor);
    }
    const sql =
      `SELECT * FROM users` +
      (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
      ` ORDER BY created_at DESC LIMIT ?`;
    binds.push(limit + 1);
    const { results } = await this.db
      .prepare(sql)
      .bind(...binds)
      .all<UserRow>();
    const rows = results ?? [];
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map(mapUser);
    const nextCursor = hasMore ? items[items.length - 1].createdAt : null;
    return { items, nextCursor };
  }

  async addSocialIdentity(input: {
    id: string;
    userId: string;
    provider: SocialProvider;
    providerSub: string;
  }): Promise<SocialIdentity> {
    const now = new Date().toISOString();
    try {
      await this.db
        .prepare(
          `INSERT INTO social_identities (id, user_id, provider, provider_sub, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(input.id, input.userId, input.provider, input.providerSub, now)
        .run();
    } catch (e) {
      if (isUniqueConstraintError(e)) {
        throw new ConflictError("Social identity already linked");
      }
      throw e;
    }
    return {
      id: input.id,
      userId: input.userId,
      provider: input.provider,
      providerSub: input.providerSub,
      createdAt: now,
    };
  }

  async findSocialIdentity(
    provider: SocialProvider,
    providerSub: string,
  ): Promise<SocialIdentity | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM social_identities WHERE provider = ? AND provider_sub = ?`,
      )
      .bind(provider, providerSub)
      .first<SocialRow>();
    return row ? mapSocial(row) : null;
  }

  async listSocialIdentities(userId: string): Promise<SocialIdentity[]> {
    const { results } = await this.db
      .prepare(`SELECT * FROM social_identities WHERE user_id = ? ORDER BY created_at ASC`)
      .bind(userId)
      .all<SocialRow>();
    return (results ?? []).map(mapSocial);
  }
}
