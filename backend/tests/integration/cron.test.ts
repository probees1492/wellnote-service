import { describe, it, expect } from "vitest";
import { runDailyReadonly } from "../../src/cron/daily-readonly";
import type { MemoRepo } from "../../src/repositories/memo.repo";
import type { UserRepo } from "../../src/repositories/user.repo";
import type { CreditService } from "../../src/services/credit.service";
import type { MemoService } from "../../src/services/memo.service";
import type { StreakService } from "../../src/services/streak.service";
import { DefaultCreditService } from "../../src/services/credit.service";
import { DefaultStreakService } from "../../src/services/streak.service";
import { makeMemo, makeUser } from "../helpers/fixtures";

const KST_MIDNIGHT_NOW = new Date("2026-06-19T15:00:00.000Z"); // -> KST 2026-06-20 00:00
const YESTERDAY = "2026-06-19";

function bareDeps() {
  return {
    memos: {} as unknown as MemoRepo,
    users: {} as unknown as UserRepo,
    creditService: {} as unknown as CreditService,
    memoService: {} as unknown as MemoService,
  };
}

describe("cron / daily-readonly (smoke)", () => {
  it("returns a deterministic result shape with the new streak counters", async () => {
    const r = await runDailyReadonly(bareDeps(), KST_MIDNIGHT_NOW);
    expect(r.readonlyTransitions).toBeGreaterThanOrEqual(0);
    expect(r.penaltiesApplied).toBe(r.readonlyTransitions);
    expect(typeof r.streakBonusesAwarded).toBe("number");
    expect(typeof r.freezesUsed).toBe("number");
    expect(typeof r.streakResets).toBe("number");
    expect(r.skippedSuspended).toBeGreaterThanOrEqual(0);
    expect(r.processed).toBeGreaterThanOrEqual(r.readonlyTransitions);
    expect(r.errors).toBeInstanceOf(Array);
  });
});

// ---------------------------------------------------------------------------
// Lightweight in-memory wiring exercising the streak system end-to-end.
// ---------------------------------------------------------------------------

interface FakeMemoRepoState {
  pending: ReturnType<typeof makeMemo>[];
  byUserDate: Map<string, ReturnType<typeof makeMemo>>;
}

function fakeMemoRepo(state: FakeMemoRepoState): MemoRepo {
  return {
    async findPendingReadonlyForDate(_dateKst: string) {
      return state.pending;
    },
    async setReadonly(id: string, readonlyAt: string) {
      const m = state.pending.find((x) => x.id === id);
      if (m) {
        m.isReadonly = true;
        m.readonlyAt = readonlyAt;
      }
      return m as any;
    },
    async findByUserAndDate(userId: string, dateKst: string) {
      return state.byUserDate.get(`${userId}|${dateKst}`) ?? null;
    },
  } as unknown as MemoRepo;
}

interface FakeUser {
  id: string;
  isSuspended: boolean;
  streakCurrent: number;
  streakLongest: number;
  streakFreezes: number;
  streakLastDay: string | null;
  creditBalance: number;
}

function fakeUserRepo(users: Map<string, FakeUser>): UserRepo {
  return {
    async findById(id: string) {
      return users.get(id) ?? null;
    },
    async updateStreak(id: string, patch: any) {
      const u = users.get(id);
      if (!u) return null;
      Object.assign(u, patch);
      return u;
    },
    async adjustCreditBalance(id: string, delta: number) {
      const u = users.get(id);
      if (!u) return 0;
      u.creditBalance = Math.max(0, u.creditBalance + delta);
      return u.creditBalance;
    },
    async list(_opts: any) {
      return { items: [...users.values()], nextCursor: null };
    },
  } as unknown as UserRepo;
}

describe("cron / daily-readonly (streak integration)", () => {
  it("first day of streak (3-day milestone path begins) awards no bonus, but increments to 1", async () => {
    const user: FakeUser = {
      id: "u-1",
      isSuspended: false,
      streakCurrent: 0,
      streakLongest: 0,
      streakFreezes: 1,
      streakLastDay: null,
      creditBalance: 100,
    };
    const memo = makeMemo({
      id: "m-1",
      userId: "u-1",
      dateKst: YESTERDAY,
      charCount: 80,
    });
    const memoState: FakeMemoRepoState = {
      pending: [memo],
      byUserDate: new Map([[`u-1|${YESTERDAY}`, memo]]),
    };
    const usersMap = new Map([["u-1", user]]);
    const memoRepo = fakeMemoRepo(memoState);
    const userRepo = fakeUserRepo(usersMap);
    const creditService = new DefaultCreditService(userRepo, {} as any);
    const streakService = new DefaultStreakService(
      userRepo,
      memoRepo,
      {} as any,
    );

    const r = await runDailyReadonly(
      {
        memos: memoRepo,
        users: userRepo,
        creditService,
        memoService: {} as any,
        streakService,
      },
      KST_MIDNIGHT_NOW,
    );
    expect(r.readonlyTransitions).toBe(1);
    expect(r.penaltiesApplied).toBe(1);
    expect(user.streakCurrent).toBe(1);
    expect(user.streakLongest).toBe(1);
    expect(r.streakBonusesAwarded).toBe(0);
  });

  it("hitting day 3 grants +20 STREAK_MILESTONE credits", async () => {
    const user: FakeUser = {
      id: "u-2",
      isSuspended: false,
      streakCurrent: 2,
      streakLongest: 2,
      streakFreezes: 1,
      streakLastDay: "2026-06-18", // day before yesterday
      creditBalance: 100,
    };
    const memo = makeMemo({
      id: "m-2",
      userId: "u-2",
      dateKst: YESTERDAY,
      charCount: 200,
    });
    const memoRepo = fakeMemoRepo({
      pending: [memo],
      byUserDate: new Map([[`u-2|${YESTERDAY}`, memo]]),
    });
    const userRepo = fakeUserRepo(new Map([["u-2", user]]));
    const creditService = new DefaultCreditService(userRepo, {} as any);
    const streakService = new DefaultStreakService(
      userRepo,
      memoRepo,
      {} as any,
    );
    const r = await runDailyReadonly(
      {
        memos: memoRepo,
        users: userRepo,
        creditService,
        memoService: {} as any,
        streakService,
      },
      KST_MIDNIGHT_NOW,
    );
    expect(user.streakCurrent).toBe(3);
    expect(r.streakBonusesAwarded).toBe(1);
    // Starting 100 - 10 readonly = 90, then +20 milestone = 110
    expect(user.creditBalance).toBe(110);
  });

  it("hitting day 100 grants +300 STREAK_MILESTONE credits", async () => {
    const user: FakeUser = {
      id: "u-100",
      isSuspended: false,
      streakCurrent: 99,
      streakLongest: 99,
      streakFreezes: 2,
      streakLastDay: "2026-06-18",
      creditBalance: 500,
    };
    const memo = makeMemo({
      id: "m-100",
      userId: "u-100",
      dateKst: YESTERDAY,
      charCount: 1000,
    });
    const memoRepo = fakeMemoRepo({
      pending: [memo],
      byUserDate: new Map([[`u-100|${YESTERDAY}`, memo]]),
    });
    const userRepo = fakeUserRepo(new Map([["u-100", user]]));
    const creditService = new DefaultCreditService(userRepo, {} as any);
    const streakService = new DefaultStreakService(
      userRepo,
      memoRepo,
      {} as any,
    );
    const r = await runDailyReadonly(
      {
        memos: memoRepo,
        users: userRepo,
        creditService,
        memoService: {} as any,
        streakService,
      },
      KST_MIDNIGHT_NOW,
    );
    expect(user.streakCurrent).toBe(100);
    expect(r.streakBonusesAwarded).toBe(1);
    // 500 - 10 + 300 = 790
    expect(user.creditBalance).toBe(790);
  });

  it("missed day with freeze available consumes a freeze and preserves streak", async () => {
    const user: FakeUser = {
      id: "u-freeze",
      isSuspended: false,
      streakCurrent: 5,
      streakLongest: 5,
      streakFreezes: 2,
      streakLastDay: "2026-06-17", // gap day
      creditBalance: 50,
    };
    // No memo for yesterday: pending list is empty for this user, but we
    // still rely on the list-based sweep to evaluate streak.
    const memoRepo = fakeMemoRepo({
      pending: [],
      byUserDate: new Map(), // no memo for u-freeze on YESTERDAY
    });
    const userRepo = fakeUserRepo(new Map([["u-freeze", user]]));
    const creditService = new DefaultCreditService(userRepo, {} as any);
    const streakService = new DefaultStreakService(
      userRepo,
      memoRepo,
      {} as any,
    );

    const r = await runDailyReadonly(
      {
        memos: memoRepo,
        users: userRepo,
        creditService,
        memoService: {} as any,
        streakService,
      },
      KST_MIDNIGHT_NOW,
    );
    expect(user.streakCurrent).toBe(5); // preserved
    expect(user.streakFreezes).toBe(1); // decremented
    expect(r.freezesUsed).toBe(1);
  });

  it("suspended users are skipped for credit + streak (readonly still flips)", async () => {
    const _u = makeUser({ id: "u-sus", isSuspended: true });
    const user: FakeUser = {
      id: "u-sus",
      isSuspended: true,
      streakCurrent: 4,
      streakLongest: 4,
      streakFreezes: 1,
      streakLastDay: "2026-06-18",
      creditBalance: 100,
    };
    const memo = makeMemo({
      id: "m-sus",
      userId: "u-sus",
      dateKst: YESTERDAY,
      charCount: 99,
    });
    const memoRepo = fakeMemoRepo({
      pending: [memo],
      byUserDate: new Map([[`u-sus|${YESTERDAY}`, memo]]),
    });
    const userRepo = fakeUserRepo(new Map([["u-sus", user]]));
    const creditService = new DefaultCreditService(userRepo, {} as any);
    const streakService = new DefaultStreakService(
      userRepo,
      memoRepo,
      {} as any,
    );

    const r = await runDailyReadonly(
      {
        memos: memoRepo,
        users: userRepo,
        creditService,
        memoService: {} as any,
        streakService,
      },
      KST_MIDNIGHT_NOW,
    );
    expect(r.skippedSuspended).toBe(1);
    expect(r.readonlyTransitions).toBe(1);
    expect(r.penaltiesApplied).toBe(0);
    // Streak should NOT have advanced (since we skip for suspended).
    expect(user.streakCurrent).toBe(4);
    expect(user.creditBalance).toBe(100);
  });
});
