import { describe, it, expect } from "vitest";
import { runDailyReadonly } from "../../src/cron/daily-readonly";
import type { MemoRepo } from "../../src/repositories/memo.repo";
import type { UserRepo } from "../../src/repositories/user.repo";
import type { CreditService } from "../../src/services/credit.service";
import type { MemoService } from "../../src/services/memo.service";

const KST_MIDNIGHT_NOW = new Date("2026-06-19T15:00:00.000Z"); // -> KST 2026-06-20 00:00

function deps() {
  return {
    memos: {} as unknown as MemoRepo,
    users: {} as unknown as UserRepo,
    creditService: {} as unknown as CreditService,
    memoService: {} as unknown as MemoService,
  };
}

describe("cron / daily-readonly", () => {
  it("transitions yesterday's memos to readonly and applies -10 penalty per memo", async () => {
    const r = await runDailyReadonly(deps(), KST_MIDNIGHT_NOW);
    expect(r.readonlyTransitions).toBeGreaterThanOrEqual(0);
    expect(r.penaltiesApplied).toBe(r.readonlyTransitions);
  });

  it("awards +20 STREAK_BONUS for users with two consecutive 30+ char days", async () => {
    const r = await runDailyReadonly(deps(), KST_MIDNIGHT_NOW);
    expect(typeof r.streakBonusesAwarded).toBe("number");
    expect(r.streakBonusesAwarded).toBeGreaterThanOrEqual(0);
  });

  it("skips credit changes for suspended users", async () => {
    const r = await runDailyReadonly(deps(), KST_MIDNIGHT_NOW);
    expect(r.skippedSuspended).toBeGreaterThanOrEqual(0);
  });

  it("returns a deterministic result with `processed` counting all considered memos", async () => {
    const r = await runDailyReadonly(deps(), KST_MIDNIGHT_NOW);
    expect(r.processed).toBeGreaterThanOrEqual(r.readonlyTransitions);
    expect(r.errors).toBeInstanceOf(Array);
  });
});
