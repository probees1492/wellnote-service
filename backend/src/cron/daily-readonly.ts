import type { Env } from "../env";
import type { CreditService } from "../services/credit.service";
import type { MemoService } from "../services/memo.service";
import type { StreakService } from "../services/streak.service";
import type { MemoRepo } from "../repositories/memo.repo";
import type { UserRepo } from "../repositories/user.repo";
import { toDateKst, previousDateKst } from "../lib/time";
import type { Memo } from "../domain/memo";
import { milestoneReward } from "../domain/streak";

export interface DailyReadonlyDeps {
  memos: MemoRepo;
  users: UserRepo;
  creditService: CreditService;
  memoService: MemoService;
  /** Optional — if omitted, streak processing is skipped (legacy tests). */
  streakService?: StreakService;
}

export interface DailyReadonlyResult {
  processed: number;
  readonlyTransitions: number;
  penaltiesApplied: number;
  /** Number of users for whom a milestone credit was granted today. */
  streakBonusesAwarded: number;
  /** Number of users whose freeze tokens were consumed to save their streak. */
  freezesUsed: number;
  /** Number of users whose streak was reset to zero. */
  streakResets: number;
  skippedSuspended: number;
  errors: string[];
}

interface MemoRepoLike {
  findPendingReadonlyForDate?(dateKst: string): Promise<Memo[]>;
  setReadonly?(id: string, readonlyAt: string): Promise<Memo>;
  findByUserAndDate?(userId: string, dateKst: string): Promise<Memo | null>;
}

interface UserRepoLike {
  findById?(id: string): Promise<{ id: string; isSuspended?: boolean } | null>;
}

function isFn(x: unknown): x is (...args: any[]) => any {
  return typeof x === "function";
}

/**
 * SPEC §3.2.5 / §6.7 — KST 00:00 cron.
 *
 * Responsibilities (per-user, for "yesterday" KST):
 *   1. Flip yesterday's memos to readonly.
 *   2. Apply the -10 readonly penalty.
 *   3. Drive the streak system (increment / freeze / reset) and grant
 *      milestone credit rewards.
 *   4. Skip suspended users for steps 2-3 (readonly conversion still runs).
 */
export async function runDailyReadonly(
  deps: DailyReadonlyDeps,
  now: Date = new Date(),
): Promise<DailyReadonlyResult> {
  const result: DailyReadonlyResult = {
    processed: 0,
    readonlyTransitions: 0,
    penaltiesApplied: 0,
    streakBonusesAwarded: 0,
    freezesUsed: 0,
    streakResets: 0,
    skippedSuspended: 0,
    errors: [],
  };

  const todayKst = toDateKst(now);
  const yesterdayKst = previousDateKst(todayKst);

  const memos = deps.memos as MemoRepoLike;
  const users = deps.users as UserRepoLike;

  let pending: Memo[] = [];
  if (isFn(memos.findPendingReadonlyForDate)) {
    try {
      pending = (await memos.findPendingReadonlyForDate!(yesterdayKst)) ?? [];
    } catch (e) {
      result.errors.push(String((e as Error).message ?? e));
    }
  }

  // Track which userIds we've evaluated for streak so we don't double-process
  // when a user happens to have multiple memos for the same day (shouldn't
  // happen given uq_memos_user_date_active, but defensive).
  const streakEvaluated = new Set<string>();

  for (const memo of pending) {
    result.processed += 1;
    let isSuspended = false;
    if (isFn(users.findById)) {
      try {
        const u = await users.findById!(memo.userId);
        isSuspended = !!u?.isSuspended;
      } catch {
        // ignore
      }
    }
    if (isSuspended) {
      result.skippedSuspended += 1;
      // Still flip readonly so the memo is locked, but skip credit & streak.
      try {
        if (isFn(memos.setReadonly)) {
          await memos.setReadonly!(memo.id, now.toISOString());
        } else {
          await deps.memoService.forceReadonly({ memoId: memo.id, now });
        }
        result.readonlyTransitions += 1;
      } catch (e) {
        result.errors.push(`setReadonly ${memo.id}: ${(e as Error).message ?? e}`);
      }
      continue;
    }

    // 1) Set readonly
    try {
      if (isFn(memos.setReadonly)) {
        await memos.setReadonly!(memo.id, now.toISOString());
      } else {
        await deps.memoService.forceReadonly({ memoId: memo.id, now });
      }
      result.readonlyTransitions += 1;
    } catch (e) {
      result.errors.push(`setReadonly ${memo.id}: ${(e as Error).message ?? e}`);
      continue;
    }

    // 2) Apply -10 penalty
    try {
      await deps.creditService.applyReadonlyPenalty({
        userId: memo.userId,
        memoId: memo.id,
      });
      result.penaltiesApplied += 1;
    } catch (e) {
      result.errors.push(`penalty ${memo.id}: ${(e as Error).message ?? e}`);
    }

    // 3) Streak evaluation for yesterday (once per user).
    if (deps.streakService && !streakEvaluated.has(memo.userId)) {
      streakEvaluated.add(memo.userId);
      await evaluateStreakForUser(deps, memo.userId, yesterdayKst, memo.id, result);
    }
  }

  // Some users may not have ANY memo for yesterday — they still need streak
  // evaluation (which will mark a freeze_used or reset). The pending list
  // above only contains users who DID write but not readonly yet, so we
  // additionally sweep any "owed" streak evaluations the caller may provide
  // via a dedicated user list. For the typical D1 path this is handled by
  // iterating users with a non-zero streak whose last_day != yesterday.
  if (deps.streakService && isFn((deps.users as any).list)) {
    try {
      const pageSize = 100;
      let cursor: string | undefined = undefined;
      // Cap pages to avoid runaway loops in degenerate cases.
      for (let page = 0; page < 50; page += 1) {
        const r: { items: any[]; nextCursor: string | null } = await (
          deps.users as any
        ).list({ cursor, limit: pageSize });
        for (const u of r.items) {
          if (!u || u.isSuspended) continue;
          if (streakEvaluated.has(u.id)) continue;
          // Only evaluate users with an active streak or who wrote yesterday;
          // brand-new zero-streak users with no memo don't need a row event.
          const hasStreak = (u.streakCurrent ?? 0) > 0;
          if (!hasStreak) continue;
          if (u.streakLastDay === yesterdayKst) continue;
          streakEvaluated.add(u.id);
          await evaluateStreakForUser(
            deps,
            u.id,
            yesterdayKst,
            null,
            result,
          );
        }
        if (!r.nextCursor) break;
        cursor = r.nextCursor;
      }
    } catch (e) {
      result.errors.push(`streak-sweep: ${(e as Error).message ?? e}`);
    }
  }

  return result;
}

async function evaluateStreakForUser(
  deps: DailyReadonlyDeps,
  userId: string,
  evaluateDateKst: string,
  referenceMemoId: string | null,
  result: DailyReadonlyResult,
): Promise<void> {
  if (!deps.streakService) return;
  try {
    const r = await deps.streakService.evaluate({
      userId,
      evaluateDateKst,
    });
    if (r.freezeUsed) result.freezesUsed += 1;
    if (r.current === 0 && !r.freezeUsed) result.streakResets += 1;
    if (r.milestoneReached) {
      const reward = milestoneReward(r.milestoneReached);
      if (reward !== null) {
        try {
          await deps.creditService.applyDelta({
            userId,
            delta: reward,
            reason: "STREAK_MILESTONE",
            referenceId: referenceMemoId,
            skipIfSuspended: true,
          });
          result.streakBonusesAwarded += 1;
        } catch (e) {
          result.errors.push(`milestone ${userId}: ${(e as Error).message ?? e}`);
        }
      }
    }
  } catch (e) {
    result.errors.push(`streak ${userId}: ${(e as Error).message ?? e}`);
  }
}

/** Cron entry called by index.ts scheduled handler. */
export async function scheduled(
  _controller: ScheduledController,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  // Construct minimal real wiring (D1 repos, real services).
  const { D1MemoRepo } = await import("../repositories/memo.repo");
  const { D1UserRepo } = await import("../repositories/user.repo");
  const { D1CreditRepo } = await import("../repositories/credit.repo");
  const { D1StreakRepo } = await import("../repositories/streak.repo");
  const { DefaultMemoService } = await import("../services/memo.service");
  const { DefaultCreditService } = await import("../services/credit.service");
  const { DefaultStreakService } = await import("../services/streak.service");
  const { WorkersCryptoService } = await import("../services/crypto.service");
  const { R2StorageService, InMemoryStorageService } = await import(
    "../services/storage.service"
  );

  const memoRepo = env.DB ? new D1MemoRepo(env.DB) : ({} as any);
  const userRepo = env.DB ? new D1UserRepo(env.DB) : ({} as any);
  const creditRepo = env.DB ? new D1CreditRepo(env.DB) : ({} as any);
  const streakRepo = env.DB ? new D1StreakRepo(env.DB) : ({} as any);
  const crypto = new WorkersCryptoService(env.KEK_MASTER ?? "");
  const storage = env.MEMO_BUCKET
    ? new R2StorageService(env.MEMO_BUCKET)
    : new InMemoryStorageService();

  const creditService = new DefaultCreditService(userRepo, creditRepo);
  const memoService = new DefaultMemoService(memoRepo, userRepo, crypto, storage);
  const streakService = new DefaultStreakService(userRepo, memoRepo, streakRepo);
  const r = await runDailyReadonly(
    {
      memos: memoRepo,
      users: userRepo,
      creditService,
      memoService,
      streakService,
    },
    new Date(),
  );
  console.log("[cron] daily-readonly", JSON.stringify(r));
}
