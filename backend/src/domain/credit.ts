export type CreditReason =
  | "SIGNUP_BONUS"
  | "READONLY_TRANSITION"
  | "STREAK_BONUS"
  | "STREAK_MILESTONE"
  | "ADMIN_GRANT"
  | "ADMIN_REVOKE";

export interface CreditTransaction {
  id: string;
  userId: string;
  delta: number;
  reason: CreditReason;
  referenceId: string | null;
  balanceAfter: number;
  createdAt: string;
}

/** Constants codified from SPEC §3.4.1 */
export const SIGNUP_BONUS_AMOUNT = 100;
export const READONLY_PENALTY_AMOUNT = 10;

/**
 * @deprecated Replaced by the milestone-based streak rewards. Kept as a
 * historical export so older callers compile; the value is no longer used
 * by the cron pipeline.
 */
export const STREAK_BONUS_AMOUNT = 20;

/**
 * @deprecated Re-exported by `../domain/streak` going forward. Kept here
 * temporarily so any external import path that pinned to the credit module
 * still resolves.
 */
export const STREAK_MIN_CHARS = 30;
