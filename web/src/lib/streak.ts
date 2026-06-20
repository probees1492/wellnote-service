// Streak constants & helpers — mirrored from backend/src/domain/streak.ts so the
// web UI can render the milestone reward table and detect celebration moments
// without an extra round-trip. Keep this list in sync with the backend.

export const MILESTONE_REWARDS: ReadonlyArray<readonly [number, number]> = [
  [3, 20],
  [7, 50],
  [14, 50],
  [30, 100],
  [50, 100],
  [100, 300],
  [365, 1000],
];

/** Set of milestone days for O(1) lookup. */
export const MILESTONE_DAYS: ReadonlySet<number> = new Set(
  MILESTONE_REWARDS.map(([d]) => d),
);

/** Returns reward credits for a milestone day, or null if not a milestone. */
export function milestoneReward(day: number): number | null {
  for (const [d, r] of MILESTONE_REWARDS) {
    if (d === day) return r;
  }
  return null;
}

/** localStorage key for the last milestone the user has been shown a
 *  celebration modal for. Used by the client-side heuristic. */
export const LAST_SEEN_MILESTONE_KEY = "wn:lastSeenMilestone";
