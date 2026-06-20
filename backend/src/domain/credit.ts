export type CreditReason =
  | "SIGNUP_BONUS"
  | "READONLY_TRANSITION"
  | "STREAK_BONUS"
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
export const STREAK_BONUS_AMOUNT = 20;
export const STREAK_MIN_CHARS = 30;
