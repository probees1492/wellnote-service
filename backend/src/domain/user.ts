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
