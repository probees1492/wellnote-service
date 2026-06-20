import type { CreditTransaction, CreditReason } from "../domain/credit";

export interface AppendTransactionInput {
  id: string;
  userId: string;
  delta: number;
  reason: CreditReason;
  referenceId?: string | null;
  balanceAfter: number;
}

export interface CreditRepo {
  appendTransaction(input: AppendTransactionInput): Promise<CreditTransaction>;
  listByUser(opts: {
    userId: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ items: CreditTransaction[]; nextCursor: string | null }>;
  /** Sum of all deltas for a user. Source of truth (cache lives on users.credit_balance). */
  sumDeltas(userId: string): Promise<number>;
}

interface CreditRow {
  id: string;
  user_id: string;
  delta: number;
  reason: CreditReason;
  reference_id: string | null;
  balance_after: number;
  created_at: string;
}

function mapTx(row: CreditRow): CreditTransaction {
  return {
    id: row.id,
    userId: row.user_id,
    delta: row.delta,
    reason: row.reason,
    referenceId: row.reference_id,
    balanceAfter: row.balance_after,
    createdAt: row.created_at,
  };
}

export class D1CreditRepo implements CreditRepo {
  constructor(private readonly db: D1Database) {}

  async appendTransaction(
    input: AppendTransactionInput,
  ): Promise<CreditTransaction> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `INSERT INTO credit_transactions
           (id, user_id, delta, reason, reference_id, balance_after, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        input.id,
        input.userId,
        input.delta,
        input.reason,
        input.referenceId ?? null,
        input.balanceAfter,
        now,
      )
      .run();
    return {
      id: input.id,
      userId: input.userId,
      delta: input.delta,
      reason: input.reason,
      referenceId: input.referenceId ?? null,
      balanceAfter: input.balanceAfter,
      createdAt: now,
    };
  }

  async listByUser(opts: {
    userId: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ items: CreditTransaction[]; nextCursor: string | null }> {
    const limit = Math.max(1, Math.min(opts.limit ?? 30, 100));
    const where: string[] = ["user_id = ?"];
    const binds: unknown[] = [opts.userId];
    if (opts.cursor) {
      where.push("created_at < ?");
      binds.push(opts.cursor);
    }
    binds.push(limit + 1);
    const { results } = await this.db
      .prepare(
        `SELECT * FROM credit_transactions
          WHERE ${where.join(" AND ")}
          ORDER BY created_at DESC, id DESC
          LIMIT ?`,
      )
      .bind(...binds)
      .all<CreditRow>();
    const rows = results ?? [];
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map(mapTx);
    const nextCursor = hasMore ? items[items.length - 1].createdAt : null;
    return { items, nextCursor };
  }

  async sumDeltas(userId: string): Promise<number> {
    const row = await this.db
      .prepare(`SELECT COALESCE(SUM(delta), 0) AS total FROM credit_transactions WHERE user_id = ?`)
      .bind(userId)
      .first<{ total: number }>();
    return row?.total ?? 0;
  }
}
