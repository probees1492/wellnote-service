import { describe, it, expect } from "vitest";
import { DefaultStreakService } from "../../src/services/streak.service";
import {
  milestoneReward,
  nextMilestoneDay,
  MAX_STREAK_FREEZES,
} from "../../src/domain/streak";

const YESTERDAY = "2026-06-19";
const DAY_BEFORE = "2026-06-18";

interface FakeUser {
  id: string;
  streakCurrent: number;
  streakLongest: number;
  streakFreezes: number;
  streakLastDay: string | null;
}

function makeRepos(initial: FakeUser, memoChars: number | null) {
  const users = new Map<string, FakeUser>([[initial.id, { ...initial }]]);
  const userRepo = {
    async findById(id: string) {
      return users.get(id) ?? null;
    },
    async updateStreak(id: string, patch: Partial<FakeUser>) {
      const u = users.get(id);
      if (!u) return null;
      Object.assign(u, patch);
      return u;
    },
  } as any;
  const memoRepo = {
    async findByUserAndDate(_userId: string, _dateKst: string) {
      if (memoChars === null) return null;
      return { id: "m-1", charCount: memoChars } as any;
    },
  };
  const events: any[] = [];
  const streakRepo = {
    async appendEvent(input: any) {
      events.push(input);
      return { ...input, id: events.length, createdAt: "now" };
    },
  };
  const svc = new DefaultStreakService(userRepo, memoRepo, streakRepo);
  return { svc, users, events };
}

describe("StreakService.evaluate", () => {
  it("qualifying day after continuation increments current and updates longest", async () => {
    const { svc, users } = makeRepos(
      {
        id: "u1",
        streakCurrent: 4,
        streakLongest: 4,
        streakFreezes: 1,
        streakLastDay: DAY_BEFORE,
      },
      120,
    );
    const r = await svc.evaluate({ userId: "u1", evaluateDateKst: YESTERDAY });
    expect(r.current).toBe(5);
    expect(r.longest).toBe(5);
    expect(r.freezeUsed).toBe(false);
    expect(users.get("u1")!.streakLastDay).toBe(YESTERDAY);
  });

  it("qualifying day with no prior streak starts at 1", async () => {
    const { svc } = makeRepos(
      {
        id: "u-new",
        streakCurrent: 0,
        streakLongest: 0,
        streakFreezes: 1,
        streakLastDay: null,
      },
      30, // exactly threshold
    );
    const r = await svc.evaluate({ userId: "u-new", evaluateDateKst: YESTERDAY });
    expect(r.current).toBe(1);
    expect(r.longest).toBe(1);
  });

  it("missed day with freeze available preserves streak and decrements freezes", async () => {
    const { svc, users } = makeRepos(
      {
        id: "u-f",
        streakCurrent: 5,
        streakLongest: 5,
        streakFreezes: 2,
        streakLastDay: "2026-06-17",
      },
      null,
    );
    const r = await svc.evaluate({ userId: "u-f", evaluateDateKst: YESTERDAY });
    expect(r.current).toBe(5);
    expect(r.freezes).toBe(1);
    expect(r.freezeUsed).toBe(true);
    expect(users.get("u-f")!.streakCurrent).toBe(5);
    expect(users.get("u-f")!.streakFreezes).toBe(1);
  });

  it("missed day with under-threshold memo still consumes freeze if available", async () => {
    const { svc } = makeRepos(
      {
        id: "u-f2",
        streakCurrent: 3,
        streakLongest: 3,
        streakFreezes: 1,
        streakLastDay: "2026-06-17",
      },
      10, // below STREAK_MIN_CHARS
    );
    const r = await svc.evaluate({
      userId: "u-f2",
      evaluateDateKst: YESTERDAY,
    });
    expect(r.current).toBe(3);
    expect(r.freezeUsed).toBe(true);
    expect(r.freezes).toBe(0);
  });

  it("missed day with no freezes resets streak to 0", async () => {
    const { svc } = makeRepos(
      {
        id: "u-r",
        streakCurrent: 7,
        streakLongest: 10,
        streakFreezes: 0,
        streakLastDay: "2026-06-17",
      },
      null,
    );
    const r = await svc.evaluate({ userId: "u-r", evaluateDateKst: YESTERDAY });
    expect(r.current).toBe(0);
    expect(r.longest).toBe(10); // longest preserved
    expect(r.freezeUsed).toBe(false);
  });

  it("milestoneReached is set when hitting days 3, 7, 14, 30, 50, 100, 365", async () => {
    const cases: Array<[number, number]> = [
      [2, 3],
      [6, 7],
      [13, 14],
      [29, 30],
      [49, 50],
      [99, 100],
      [364, 365],
    ];
    for (const [start, milestone] of cases) {
      const { svc } = makeRepos(
        {
          id: `u-${milestone}`,
          streakCurrent: start,
          streakLongest: start,
          streakFreezes: 1,
          streakLastDay: DAY_BEFORE,
        },
        100,
      );
      const r = await svc.evaluate({
        userId: `u-${milestone}`,
        evaluateDateKst: YESTERDAY,
      });
      expect(r.milestoneReached).toBe(milestone);
      expect(milestoneReward(milestone)).not.toBeNull();
    }
  });

  it("freeze is refilled when streak hits a multiple of 7 (cap 3)", async () => {
    const { svc, users } = makeRepos(
      {
        id: "u-7",
        streakCurrent: 6,
        streakLongest: 6,
        streakFreezes: 0,
        streakLastDay: DAY_BEFORE,
      },
      50,
    );
    const r = await svc.evaluate({ userId: "u-7", evaluateDateKst: YESTERDAY });
    expect(r.current).toBe(7);
    expect(r.freezes).toBe(1); // 0 -> 1 refill
    expect(users.get("u-7")!.streakFreezes).toBe(1);
  });

  it("freeze refill is capped at MAX_STREAK_FREEZES (3)", async () => {
    const { svc } = makeRepos(
      {
        id: "u-cap",
        streakCurrent: 13,
        streakLongest: 13,
        streakFreezes: MAX_STREAK_FREEZES,
        streakLastDay: DAY_BEFORE,
      },
      50,
    );
    const r = await svc.evaluate({
      userId: "u-cap",
      evaluateDateKst: YESTERDAY,
    });
    expect(r.current).toBe(14);
    expect(r.freezes).toBe(MAX_STREAK_FREEZES);
  });

  it("non-contiguous prior lastDay restarts streak at 1", async () => {
    const { svc } = makeRepos(
      {
        id: "u-gap",
        streakCurrent: 10,
        streakLongest: 10,
        streakFreezes: 0,
        streakLastDay: "2026-06-10", // far in the past
      },
      80,
    );
    const r = await svc.evaluate({
      userId: "u-gap",
      evaluateDateKst: YESTERDAY,
    });
    expect(r.current).toBe(1);
    expect(r.longest).toBe(10); // preserved
  });
});

describe("StreakService.getStatus", () => {
  it("computes nextMilestone and daysToNextMilestone for fresh user", async () => {
    const { svc } = makeRepos(
      {
        id: "u-s",
        streakCurrent: 0,
        streakLongest: 0,
        streakFreezes: 1,
        streakLastDay: null,
      },
      0,
    );
    const s = await svc.getStatus("u-s");
    expect(s.nextMilestone).toBe(3);
    expect(s.daysToNextMilestone).toBe(3);
  });

  it("returns next milestone past current streak", async () => {
    const { svc } = makeRepos(
      {
        id: "u-s2",
        streakCurrent: 8,
        streakLongest: 8,
        streakFreezes: 1,
        streakLastDay: YESTERDAY,
      },
      0,
    );
    const s = await svc.getStatus("u-s2");
    expect(s.current).toBe(8);
    expect(s.nextMilestone).toBe(14);
    expect(s.daysToNextMilestone).toBe(6);
  });

  it("returns null nextMilestone when past the final milestone", async () => {
    const { svc } = makeRepos(
      {
        id: "u-s3",
        streakCurrent: 400,
        streakLongest: 400,
        streakFreezes: 3,
        streakLastDay: YESTERDAY,
      },
      0,
    );
    const s = await svc.getStatus("u-s3");
    expect(s.nextMilestone).toBeNull();
    expect(s.daysToNextMilestone).toBeNull();
  });
});

describe("milestoneReward / nextMilestoneDay", () => {
  it("milestoneReward returns the correct payout for each milestone", () => {
    expect(milestoneReward(3)).toBe(20);
    expect(milestoneReward(7)).toBe(50);
    expect(milestoneReward(14)).toBe(50);
    expect(milestoneReward(30)).toBe(100);
    expect(milestoneReward(50)).toBe(100);
    expect(milestoneReward(100)).toBe(300);
    expect(milestoneReward(365)).toBe(1000);
    expect(milestoneReward(4)).toBeNull();
  });

  it("nextMilestoneDay advances correctly", () => {
    expect(nextMilestoneDay(0)).toBe(3);
    expect(nextMilestoneDay(3)).toBe(7);
    expect(nextMilestoneDay(7)).toBe(14);
    expect(nextMilestoneDay(50)).toBe(100);
    expect(nextMilestoneDay(364)).toBe(365);
    expect(nextMilestoneDay(365)).toBeNull();
    expect(nextMilestoneDay(1000)).toBeNull();
  });
});
