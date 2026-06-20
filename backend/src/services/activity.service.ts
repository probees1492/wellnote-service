import {
  type ActivityGrid,
  type ActivityCell,
  activityLevelFromCharCount,
} from "../domain/memo";
import type { MemoRepo } from "../repositories/memo.repo";
import { enumerateKstDates, previousDateKst, todayKst } from "../lib/time";

export interface ActivityService {
  getGrid(opts: {
    userId: string;
    from?: string;
    to?: string;
    now?: Date;
  }): Promise<ActivityGrid>;
}

interface MemoRepoLike {
  activityCells?(userId: string, from: string, to: string): Promise<ActivityCell[]>;
}

function isFn(x: unknown): x is (...args: any[]) => any {
  return typeof x === "function";
}

/** Compute `from` as 363 days prior to `to` (inclusive 364-day window). */
function defaultFromForTo(to: string): string {
  let d = to;
  for (let i = 0; i < 363; i++) d = previousDateKst(d);
  return d;
}

export class DefaultActivityService implements ActivityService {
  constructor(private readonly memos: MemoRepo | MemoRepoLike) {}

  async getGrid(opts: {
    userId: string;
    from?: string;
    to?: string;
    now?: Date;
  }): Promise<ActivityGrid> {
    const now = opts.now ?? new Date();
    const to = opts.to ?? todayKst(now);
    const from = opts.from ?? defaultFromForTo(to);
    const dates = enumerateKstDates(from, to);

    const cellsByDate = new Map<string, ActivityCell>();
    const r = this.memos as MemoRepoLike;
    if (isFn(r.activityCells)) {
      try {
        const cells = await r.activityCells!(opts.userId, from, to);
        for (const c of cells ?? []) {
          cellsByDate.set(c.date, c);
        }
      } catch {
        // ignore
      }
    }
    const cells: ActivityCell[] = dates.map((d) => {
      const existing = cellsByDate.get(d);
      if (existing) {
        return {
          date: d,
          charCount: existing.charCount,
          memoId: existing.memoId,
          level: activityLevelFromCharCount(existing.charCount),
        };
      }
      return { date: d, charCount: 0, memoId: null, level: 0 };
    });
    return { from, to, cells };
  }
}
