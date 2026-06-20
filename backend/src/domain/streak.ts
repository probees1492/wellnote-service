/**
 * Streak domain constants & helpers.
 *
 * The streak system is Duolingo-inspired: write at least 30 characters per
 * KST calendar day to grow the streak. Missed days consume one "freeze"
 * token (auto-replenished at every multiple of 7), and once freezes run out
 * the streak resets to zero. Reaching one of MILESTONE_DAYS triggers a
 * one-time STREAK_MILESTONE credit reward for the user.
 */

/** Minimum char count for a memo to count toward the streak. */
export const STREAK_MIN_CHARS = 30;

/** Hard cap on freezes a user may hold at one time. */
export const MAX_STREAK_FREEZES = 3;

/** Streak length at which a free freeze is granted. */
export const FREEZE_REFILL_INTERVAL = 7;

/** Milestone day → credit reward. Order matters for nextMilestone calc. */
export const MILESTONE_REWARDS: ReadonlyArray<readonly [number, number]> = [
  [3, 20],
  [7, 50],
  [14, 50],
  [30, 100],
  [50, 100],
  [100, 300],
  [365, 1000],
];

export type StreakEventType =
  | "increment"
  | "freeze_used"
  | "reset"
  | "milestone";

export interface StreakEvent {
  id: number;
  userId: string;
  eventType: StreakEventType;
  dayKst: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

/** Returns reward credits for a milestone day, or null if not a milestone. */
export function milestoneReward(day: number): number | null {
  for (const [d, r] of MILESTONE_REWARDS) {
    if (d === day) return r;
  }
  return null;
}

/** Returns the next milestone day strictly greater than `current`, or null. */
export function nextMilestoneDay(current: number): number | null {
  for (const [d] of MILESTONE_REWARDS) {
    if (d > current) return d;
  }
  return null;
}
