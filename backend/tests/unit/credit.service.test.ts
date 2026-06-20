import { describe, it, expect, beforeEach } from "vitest";
import { DefaultCreditService } from "../../src/services/credit.service";
import {
  SIGNUP_BONUS_AMOUNT,
  READONLY_PENALTY_AMOUNT,
} from "../../src/domain/credit";
import type { UserRepo } from "../../src/repositories/user.repo";
import type { CreditRepo } from "../../src/repositories/credit.repo";

function makeService() {
  const users: UserRepo = {} as unknown as UserRepo;
  const credits: CreditRepo = {} as unknown as CreditRepo;
  return new DefaultCreditService(users, credits);
}

describe("CreditService", () => {
  let service: ReturnType<typeof makeService>;
  beforeEach(() => {
    service = makeService();
  });

  it("awards SIGNUP_BONUS of +100 exactly once", async () => {
    const r = await service.awardSignupBonus("user-1");
    expect(r.balanceAfter).toBe(SIGNUP_BONUS_AMOUNT);
  });

  it("applies READONLY_TRANSITION -10 against a fresh +100 user (balance 90)", async () => {
    await service.awardSignupBonus("user-1");
    const r = await service.applyReadonlyPenalty({
      userId: "user-1",
      memoId: "memo-1",
    });
    expect(r.delta).toBe(-READONLY_PENALTY_AMOUNT);
    expect(r.balanceAfter).toBe(SIGNUP_BONUS_AMOUNT - READONLY_PENALTY_AMOUNT);
  });

  it("clamps readonly penalty at 0 (never negative)", async () => {
    const r = await service.applyDelta({
      userId: "user-low",
      delta: -100,
      reason: "READONLY_TRANSITION",
    });
    expect(r.balanceAfter).toBe(0);
    expect(r.delta).toBeGreaterThanOrEqual(-100);
    expect(r.delta).toBeLessThanOrEqual(0);
  });

  it("applies STREAK_MILESTONE deltas through applyDelta with the new reason code", async () => {
    await service.awardSignupBonus("user-m");
    const r = await service.applyDelta({
      userId: "user-m",
      delta: 100,
      reason: "STREAK_MILESTONE",
      referenceId: "milestone-30",
    });
    expect(r.delta).toBe(100);
    expect(r.balanceAfter).toBe(SIGNUP_BONUS_AMOUNT + 100);
    expect(r.transaction.reason).toBe("STREAK_MILESTONE");
  });

  it("skips all deltas for suspended users when skipIfSuspended=true", async () => {
    const r = await service.applyDelta({
      userId: "user-suspended",
      delta: -10,
      reason: "READONLY_TRANSITION",
      skipIfSuspended: true,
    });
    expect(r.delta).toBe(0);
  });

  it("adminRevoke clamps to current balance and reports requested vs actual", async () => {
    const r = await service.adminRevoke({
      userId: "user-low",
      amount: 9999,
      adminActionId: "admin-act-1",
    });
    expect(r.requested).toBe(9999);
    expect(r.delta).toBeGreaterThanOrEqual(-9999);
    expect(r.delta).toBeLessThanOrEqual(0);
    expect(r.balanceAfter).toBe(0);
  });
});
