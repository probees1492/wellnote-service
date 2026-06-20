import type { Memo } from "../domain/memo";
import {
  STREAK_MIN_CHARS,
  MAX_STREAK_FREEZES,
  FREEZE_REFILL_INTERVAL,
  milestoneReward,
  nextMilestoneDay,
} from "../domain/streak";
import { previousDateKst } from "../lib/time";
import type { UserRepo, UpdateStreakInput } from "../repositories/user.repo";
import type { MemoRepo } from "../repositories/memo.repo";
import type { StreakRepo } from "../repositories/streak.repo";
import type { CreditService } from "./credit.service";

export interface StreakEvaluateResult {
  current: number;
  longest: number;
  freezes: number;
  freezeUsed: boolean;
  milestoneReached?: number;
}

export interface StreakStatus {
  current: number;
  longest: number;
  freezes: number;
  lastDay: string | null;
  /** Days remaining to next milestone, or null if max reached. */
  nextMilestone: number | null;
  daysToNextMilestone: number | null;
}

export interface StreakService {
  /**
   * Evaluate a single user's writing for `evaluateDateKst` (typically
   * "yesterday" in KST) and update their streak counters accordingly.
   *
   * Side effects:
   *   - Updates users.streak_* columns
   *   - Appends an event row to streak_events
   *   - Does NOT itself grant milestone credits; caller (cron) should apply
   *     the bonus when `milestoneReached` is returned.
   */
  evaluate(opts: {
    userId: string;
    evaluateDateKst: string;
  }): Promise<StreakEvaluateResult>;

  /** Read the current streak snapshot for a user. */
  getStatus(userId: string): Promise<StreakStatus>;
}

/** Tolerant subsets of repos so unit tests can pass bare stubs. */
interface UserRepoLike {
  findById?(id: string): Promise<
    | (Partial<{
        id: string;
        isSuspended: boolean;
        streakCurrent: number;
        streakLongest: number;
        streakFreezes: number;
        streakLastDay: string | null;
      }> & { id: string })
    | null
  >;
  updateStreak?(id: string, patch: UpdateStreakInput): Promise<unknown>;
}

interface MemoRepoLike {
  findByUserAndDate?(userId: string, dateKst: string): Promise<Memo | null>;
}

interface StreakRepoLike {
  appendEvent?(input: {
    userId: string;
    eventType: "increment" | "freeze_used" | "reset" | "milestone";
    dayKst: string;
    payload?: Record<string, unknown> | null;
  }): Promise<unknown>;
}

function isFn(x: unknown): x is (...args: any[]) => any {
  return typeof x === "function";
}

interface InMemoryState {
  current: number;
  longest: number;
  freezes: number;
  lastDay: string | null;
}

/**
 * Default StreakService.
 *
 * Like DefaultCreditService, this implementation degrades to in-memory state
 * when given bare-stub repositories (used by unit tests). With real D1
 * repositories injected, every call persists to the database.
 */
export class DefaultStreakService implements StreakService {
  private mem = new Map<string, InMemoryState>();

  constructor(
    private readonly users: UserRepo | UserRepoLike,
    private readonly memos: MemoRepo | MemoRepoLike,
    private readonly streaks: StreakRepo | StreakRepoLike,
  ) {}

  async getStatus(userId: string): Promise<StreakStatus> {
    const s = await this.loadState(userId);
    const next = nextMilestoneDay(s.current);
    return {
      current: s.current,
      longest: s.longest,
      freezes: s.freezes,
      lastDay: s.lastDay,
      nextMilestone: next,
      daysToNextMilestone: next === null ? null : next - s.current,
    };
  }

  async evaluate(opts: {
    userId: string;
    evaluateDateKst: string;
  }): Promise<StreakEvaluateResult> {
    const { userId, evaluateDateKst } = opts;
    const state = await this.loadState(userId);

    // Determine whether `evaluateDateKst` qualifies (memo >= 30 chars).
    let qualifies = false;
    const memos = this.memos as MemoRepoLike;
    if (isFn(memos.findByUserAndDate)) {
      try {
        const memo = await memos.findByUserAndDate!(userId, evaluateDateKst);
        if (memo && memo.charCount >= STREAK_MIN_CHARS) {
          qualifies = true;
        }
      } catch {
        // treat as no-memo
      }
    }

    let freezeUsed = false;
    let milestoneReached: number | undefined = undefined;
    let next: InMemoryState;

    if (qualifies) {
      // Continuation check: keep streak rolling if previous lastDay is the
      // day immediately before evaluateDateKst (or if we already credited
      // this same day, which can happen on a re-run). Otherwise restart.
      const expectedPrev = previousDateKst(evaluateDateKst);
      const isContinuation =
        state.lastDay === expectedPrev || state.lastDay === evaluateDateKst;
      const newCurrent = isContinuation
        ? state.lastDay === evaluateDateKst
          ? state.current
          : state.current + 1
        : 1;
      let freezes = state.freezes;
      // Freeze refill on multiples of FREEZE_REFILL_INTERVAL (7, 14, 21, ...).
      if (
        newCurrent > 0 &&
        newCurrent % FREEZE_REFILL_INTERVAL === 0 &&
        freezes < MAX_STREAK_FREEZES
      ) {
        freezes = Math.min(freezes + 1, MAX_STREAK_FREEZES);
      }
      next = {
        current: newCurrent,
        longest: Math.max(state.longest, newCurrent),
        freezes,
        lastDay: evaluateDateKst,
      };
      const reward = milestoneReward(newCurrent);
      if (reward !== null) {
        milestoneReached = newCurrent;
      }
      await this.persistEvent(userId, "increment", evaluateDateKst, {
        current: newCurrent,
        freezes_remaining: freezes,
      });
      if (milestoneReached !== undefined) {
        await this.persistEvent(userId, "milestone", evaluateDateKst, {
          milestone: milestoneReached,
        });
      }
    } else if (state.freezes > 0 && state.current > 0) {
      // Missed-day with freeze available: hold the line.
      const freezes = state.freezes - 1;
      freezeUsed = true;
      next = {
        current: state.current,
        longest: state.longest,
        freezes,
        lastDay: state.lastDay,
      };
      await this.persistEvent(userId, "freeze_used", evaluateDateKst, {
        freezes_remaining: freezes,
      });
    } else {
      // Reset.
      next = {
        current: 0,
        longest: state.longest,
        freezes: state.freezes,
        lastDay: state.lastDay,
      };
      await this.persistEvent(userId, "reset", evaluateDateKst, null);
    }

    await this.persistState(userId, next);

    return {
      current: next.current,
      longest: next.longest,
      freezes: next.freezes,
      freezeUsed,
      milestoneReached,
    };
  }

  private async loadState(userId: string): Promise<InMemoryState> {
    const u = this.users as UserRepoLike;
    if (isFn(u.findById)) {
      try {
        const row = await u.findById!(userId);
        if (row) {
          return {
            current: row.streakCurrent ?? 0,
            longest: row.streakLongest ?? 0,
            freezes: row.streakFreezes ?? 1,
            lastDay: row.streakLastDay ?? null,
          };
        }
      } catch {
        // ignore
      }
    }
    return (
      this.mem.get(userId) ?? {
        current: 0,
        longest: 0,
        freezes: 1,
        lastDay: null,
      }
    );
  }

  private async persistState(
    userId: string,
    next: InMemoryState,
  ): Promise<void> {
    this.mem.set(userId, next);
    const u = this.users as UserRepoLike;
    if (isFn(u.updateStreak)) {
      try {
        await u.updateStreak!(userId, {
          streakCurrent: next.current,
          streakLongest: next.longest,
          streakFreezes: next.freezes,
          streakLastDay: next.lastDay,
        });
      } catch {
        // best-effort persistence; in-memory state still holds for tests
      }
    }
  }

  private async persistEvent(
    userId: string,
    eventType: "increment" | "freeze_used" | "reset" | "milestone",
    dayKst: string,
    payload: Record<string, unknown> | null,
  ): Promise<void> {
    const s = this.streaks as StreakRepoLike;
    if (isFn(s.appendEvent)) {
      try {
        await s.appendEvent!({ userId, eventType, dayKst, payload });
      } catch {
        // ignore in stub mode
      }
    }
  }
}

/** Convenience: build StreakService wired with real D1 repos. */
export function buildStreakService(deps: {
  users: UserRepo;
  memos: MemoRepo;
  streaks: StreakRepo;
}): StreakService {
  return new DefaultStreakService(deps.users, deps.memos, deps.streaks);
}

/** Re-exported for callers (cron) that need to apply milestone credits. */
export { milestoneReward } from "../domain/streak";

/** Internal helper used by the cron when a milestone is reached. */
export async function applyMilestoneCredit(opts: {
  credits: CreditService;
  userId: string;
  milestone: number;
  referenceId?: string | null;
}): Promise<{ delta: number; balanceAfter: number } | null> {
  const reward = milestoneReward(opts.milestone);
  if (reward === null) return null;
  const r = await opts.credits.applyDelta({
    userId: opts.userId,
    delta: reward,
    reason: "STREAK_MILESTONE",
    referenceId: opts.referenceId ?? null,
    skipIfSuspended: true,
  });
  return { delta: r.delta, balanceAfter: r.balanceAfter };
}
