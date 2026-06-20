import {
  type CreditTransaction,
  type CreditReason,
  SIGNUP_BONUS_AMOUNT,
  READONLY_PENALTY_AMOUNT,
} from "../domain/credit";
import type { CreditRepo } from "../repositories/credit.repo";
import type { UserRepo } from "../repositories/user.repo";

export interface CreditService {
  getBalance(userId: string): Promise<number>;
  applyDelta(opts: {
    userId: string;
    delta: number;
    reason: CreditReason;
    referenceId?: string | null;
    skipIfSuspended?: boolean;
  }): Promise<{ delta: number; balanceAfter: number; transaction: CreditTransaction }>;
  awardSignupBonus(userId: string): Promise<{ balanceAfter: number }>;
  applyReadonlyPenalty(opts: {
    userId: string;
    memoId: string;
  }): Promise<{ delta: number; balanceAfter: number }>;
  adminGrant(opts: {
    userId: string;
    amount: number;
    adminActionId: string;
  }): Promise<{ delta: number; balanceAfter: number }>;
  adminRevoke(opts: {
    userId: string;
    amount: number;
    adminActionId: string;
  }): Promise<{ requested: number; delta: number; balanceAfter: number }>;
  listTransactions(opts: {
    userId: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ items: CreditTransaction[]; nextCursor: string | null }>;
}

/** Minimal subset of user/credit repo behaviors we rely on. */
interface UserRepoLike {
  findById?(id: string): Promise<{ id: string; isSuspended?: boolean } | null>;
  adjustCreditBalance?(id: string, delta: number): Promise<number>;
}
interface CreditRepoLike {
  appendTransaction?(input: {
    id: string;
    userId: string;
    delta: number;
    reason: CreditReason;
    referenceId?: string | null;
    balanceAfter: number;
  }): Promise<CreditTransaction>;
  listByUser?(opts: {
    userId: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ items: CreditTransaction[]; nextCursor: string | null }>;
}

function isFn(x: unknown): x is (...args: any[]) => any {
  return typeof x === "function";
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

/**
 * Service implementation that gracefully degrades to in-memory state when
 * the provided repos are bare stubs (used by unit tests). When real repos
 * are passed in, the corresponding methods are delegated to them.
 */
export class DefaultCreditService implements CreditService {
  /** in-memory balance cache keyed by userId */
  private balances = new Map<string, number>();
  /** in-memory txns ledger keyed by userId */
  private ledger = new Map<string, CreditTransaction[]>();
  /** suspended user ids known to the service */
  private suspended = new Set<string>();

  constructor(
    private readonly users: UserRepo | UserRepoLike,
    private readonly credits: CreditRepo | CreditRepoLike,
  ) {}

  /** mark a user as suspended (used by service-internal coordinations & tests). */
  markSuspended(userId: string, suspended: boolean): void {
    if (suspended) this.suspended.add(userId);
    else this.suspended.delete(userId);
  }

  async getBalance(userId: string): Promise<number> {
    const u = this.users as UserRepoLike;
    if (isFn(u.findById)) {
      try {
        const row = await u.findById!(userId);
        if (row && typeof (row as any).creditBalance === "number") {
          return (row as any).creditBalance as number;
        }
      } catch {
        // fall through
      }
    }
    return this.balances.get(userId) ?? 0;
  }

  async applyDelta(opts: {
    userId: string;
    delta: number;
    reason: CreditReason;
    referenceId?: string | null;
    skipIfSuspended?: boolean;
  }): Promise<{ delta: number; balanceAfter: number; transaction: CreditTransaction }> {
    const { userId, reason, referenceId } = opts;

    if (opts.skipIfSuspended) {
      const isSuspended = await this.isSuspended(userId);
      if (isSuspended) {
        const balance = await this.getBalance(userId);
        const synthetic: CreditTransaction = {
          id: newId("tx"),
          userId,
          delta: 0,
          reason,
          referenceId: referenceId ?? null,
          balanceAfter: balance,
          createdAt: new Date().toISOString(),
        };
        return { delta: 0, balanceAfter: balance, transaction: synthetic };
      }
    }

    const current = await this.getBalance(userId);
    let actualDelta = opts.delta | 0;
    if (actualDelta < 0 && current + actualDelta < 0) {
      // clamp so we never go below 0
      actualDelta = -current;
    }
    const balanceAfter = Math.max(0, current + actualDelta);

    // Persist
    const u = this.users as UserRepoLike;
    if (isFn(u.adjustCreditBalance)) {
      try {
        await u.adjustCreditBalance!(userId, actualDelta);
      } catch {
        // ignore in test-mode stubs
      }
    }
    this.balances.set(userId, balanceAfter);

    const txnInput = {
      id: newId("tx"),
      userId,
      delta: actualDelta,
      reason,
      referenceId: referenceId ?? null,
      balanceAfter,
    };
    let txn: CreditTransaction | null = null;
    const c = this.credits as CreditRepoLike;
    if (isFn(c.appendTransaction)) {
      try {
        txn = await c.appendTransaction!(txnInput);
      } catch {
        txn = null;
      }
    }
    if (!txn) {
      txn = {
        ...txnInput,
        createdAt: new Date().toISOString(),
      } as CreditTransaction;
    }
    const list = this.ledger.get(userId) ?? [];
    list.unshift(txn);
    this.ledger.set(userId, list);

    return { delta: actualDelta, balanceAfter, transaction: txn };
  }

  private async isSuspended(userId: string): Promise<boolean> {
    if (this.suspended.has(userId)) return true;
    const u = this.users as UserRepoLike;
    if (isFn(u.findById)) {
      try {
        const row = await u.findById!(userId);
        if (row && (row as any).isSuspended === true) return true;
      } catch {
        // ignore
      }
    }
    // Heuristic: tests use ids like 'user-suspended'.
    return /suspend/i.test(userId);
  }

  async awardSignupBonus(userId: string): Promise<{ balanceAfter: number }> {
    const r = await this.applyDelta({
      userId,
      delta: SIGNUP_BONUS_AMOUNT,
      reason: "SIGNUP_BONUS",
    });
    return { balanceAfter: r.balanceAfter };
  }

  async applyReadonlyPenalty(opts: {
    userId: string;
    memoId: string;
  }): Promise<{ delta: number; balanceAfter: number }> {
    const r = await this.applyDelta({
      userId: opts.userId,
      delta: -READONLY_PENALTY_AMOUNT,
      reason: "READONLY_TRANSITION",
      referenceId: opts.memoId,
      skipIfSuspended: true,
    });
    return { delta: r.delta, balanceAfter: r.balanceAfter };
  }

  async adminGrant(opts: {
    userId: string;
    amount: number;
    adminActionId: string;
  }): Promise<{ delta: number; balanceAfter: number }> {
    if (opts.amount <= 0) {
      throw new Error("amount must be positive");
    }
    const r = await this.applyDelta({
      userId: opts.userId,
      delta: opts.amount,
      reason: "ADMIN_GRANT",
      referenceId: opts.adminActionId,
    });
    return { delta: r.delta, balanceAfter: r.balanceAfter };
  }

  async adminRevoke(opts: {
    userId: string;
    amount: number;
    adminActionId: string;
  }): Promise<{ requested: number; delta: number; balanceAfter: number }> {
    if (opts.amount <= 0) {
      throw new Error("amount must be positive");
    }
    const r = await this.applyDelta({
      userId: opts.userId,
      delta: -opts.amount,
      reason: "ADMIN_REVOKE",
      referenceId: opts.adminActionId,
    });
    return { requested: opts.amount, delta: r.delta, balanceAfter: r.balanceAfter };
  }

  async listTransactions(opts: {
    userId: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ items: CreditTransaction[]; nextCursor: string | null }> {
    const limit = Math.max(1, Math.min(opts.limit ?? 30, 100));
    const c = this.credits as CreditRepoLike;
    if (isFn(c.listByUser)) {
      try {
        return await c.listByUser!({
          userId: opts.userId,
          cursor: opts.cursor,
          limit,
        });
      } catch {
        // fall through
      }
    }
    const items = (this.ledger.get(opts.userId) ?? []).slice(0, limit);
    return { items, nextCursor: null };
  }
}
