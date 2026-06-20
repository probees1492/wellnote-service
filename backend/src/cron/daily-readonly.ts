import type { Env } from "../env";
import type { CreditService } from "../services/credit.service";
import type { MemoService } from "../services/memo.service";
import type { MemoRepo } from "../repositories/memo.repo";
import type { UserRepo } from "../repositories/user.repo";
import { toDateKst, previousDateKst } from "../lib/time";
import type { Memo } from "../domain/memo";
import { STREAK_MIN_CHARS } from "../domain/credit";

export interface DailyReadonlyDeps {
  memos: MemoRepo;
  users: UserRepo;
  creditService: CreditService;
  memoService: MemoService;
}

export interface DailyReadonlyResult {
  processed: number;
  readonlyTransitions: number;
  penaltiesApplied: number;
  streakBonusesAwarded: number;
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
    skippedSuspended: 0,
    errors: [],
  };

  const todayKst = toDateKst(now);
  const yesterdayKst = previousDateKst(todayKst);
  const dayBeforeKst = previousDateKst(yesterdayKst);

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

    // 3) Streak bonus: lookup day-before-yesterday's memo char count
    let dayBeforeChars = 0;
    if (isFn(memos.findByUserAndDate)) {
      try {
        const dbMemo = await memos.findByUserAndDate!(memo.userId, dayBeforeKst);
        dayBeforeChars = dbMemo?.charCount ?? 0;
      } catch {
        // ignore
      }
    }
    if (memo.charCount >= STREAK_MIN_CHARS && dayBeforeChars >= STREAK_MIN_CHARS) {
      try {
        const bonus = await deps.creditService.evaluateAndApplyStreakBonus({
          userId: memo.userId,
          yesterdayChars: memo.charCount,
          dayBeforeChars,
          referenceMemoId: memo.id,
        });
        if (bonus) result.streakBonusesAwarded += 1;
      } catch (e) {
        result.errors.push(`streak ${memo.id}: ${(e as Error).message ?? e}`);
      }
    }
  }

  return result;
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
  const { DefaultMemoService } = await import("../services/memo.service");
  const { DefaultCreditService } = await import("../services/credit.service");
  const { WorkersCryptoService } = await import("../services/crypto.service");
  const { R2StorageService, InMemoryStorageService } = await import(
    "../services/storage.service"
  );

  const memoRepo = env.DB ? new D1MemoRepo(env.DB) : ({} as any);
  const userRepo = env.DB ? new D1UserRepo(env.DB) : ({} as any);
  const creditRepo = env.DB ? new D1CreditRepo(env.DB) : ({} as any);
  const crypto = new WorkersCryptoService(env.KEK_MASTER ?? "");
  const storage = env.MEMO_BUCKET
    ? new R2StorageService(env.MEMO_BUCKET)
    : new InMemoryStorageService();

  const creditService = new DefaultCreditService(userRepo, creditRepo);
  const memoService = new DefaultMemoService(memoRepo, userRepo, crypto, storage);
  const r = await runDailyReadonly(
    { memos: memoRepo, users: userRepo, creditService, memoService },
    new Date(),
  );
  console.log("[cron] daily-readonly", JSON.stringify(r));
}
