export type UserRole = "user" | "admin" | "superadmin";

export interface User {
  id: string;
  email: string;
  emailVerifiedAt: string | null;
  displayName: string;
  passwordHash: string | null;
  role: UserRole;
  creditBalance: number;
  isSuspended: boolean;
  createdAt: string;
  updatedAt: string;
  /** Current consecutive-day writing streak (KST). */
  streakCurrent: number;
  /** All-time longest streak length. */
  streakLongest: number;
  /** Remaining "freeze" tokens that protect the streak when a day is missed. */
  streakFreezes: number;
  /** KST date string of the most recent day counted toward the streak. */
  streakLastDay: string | null;
  /** ISO timestamp of the last 필명(display_name) change, or null if never renamed. */
  displayNameChangedAt: string | null;
  /** R2 object key for the profile avatar, or null if none uploaded. */
  avatarObjectKey: string | null;
  /** MIME type stored alongside the avatar so GET requests can echo it back. */
  avatarContentType: string | null;
  /** ISO timestamp of the last avatar change — used as a cache-bust token. */
  avatarUpdatedAt: string | null;
}

export type SocialProvider = "email" | "google" | "apple";

export interface SocialIdentity {
  id: string;
  userId: string;
  provider: SocialProvider;
  providerSub: string;
  createdAt: string;
}

export interface Session {
  id: string; // hashed refresh token
  userId: string;
  deviceLabel: string | null;
  ip: string | null;
  expiresAt: string;
  createdAt: string;
  lastUsedAt: string;
}
