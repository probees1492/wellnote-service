import { describe, it, expect, beforeEach } from "vitest";
import { DefaultCreditService } from "../../src/services/credit.service";
import {
  SIGNUP_BONUS_AMOUNT,
  READONLY_PENALTY_AMOUNT,
  STREAK_BONUS_AMOUNT,
} from "../../src/domain/credit";
import type { UserRepo } from "../../src/repositories/user.repo";
import type { CreditRepo } from "../../src/repositories/credit.repo";

/**
 * These tests intentionally pass real (stub) repositories so the service's
 * `throw new Error('not implemented')` paths produce RED.
 *
 * Backend implementer: replace stub bodies, then make these green.
 */

function makeService() {
  // Bare repos with stub methods — sufficient because the service is a stub.
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
    // Hypothetical: user with balance 5
    // After implementation, the test should drive the user to balance 5, then
    // call applyReadonlyPenalty; expected balanceAfter = 0, actual delta = -5.
    const r = await service.applyDelta({
      userId: "user-low",
      delta: -100,
      reason: "READONLY_TRANSITION",
    });
    expect(r.balanceAfter).toBe(0);
    // Actual delta must reflect what was applied, not requested.
    expect(r.delta).toBeGreaterThanOrEqual(-100);
    expect(r.delta).toBeLessThanOrEqual(0);
  });

  it("STREAK_BONUS: +20 when both prior days have >=30 chars", async () => {
    const r = await service.evaluateAndApplyStreakBonus({
      userId: "user-1",
      yesterdayChars: 50,
      dayBeforeChars: 30,
    });
    expect(r).not.toBeNull();
    expect(r!.delta).toBe(STREAK_BONUS_AMOUNT);
  });

  it("STREAK_BONUS: not awarded when yesterday < 30 chars", async () => {
    const r = await service.evaluateAndApplyStreakBonus({
      userId: "user-1",
      yesterdayChars: 25,
      dayBeforeChars: 200,
    });
    expect(r).toBeNull();
  });

  it("STREAK_BONUS: not awarded when day-before < 30 chars", async () => {
    const r = await service.evaluateAndApplyStreakBonus({
      userId: "user-1",
      yesterdayChars: 100,
      dayBeforeChars: 29,
    });
    expect(r).toBeNull();
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
