import type { User } from "../../src/domain/user";
import type { Memo } from "../../src/domain/memo";

export const NOW = new Date("2026-06-20T05:30:00.000Z"); // KST 14:30
export const YESTERDAY_KST = "2026-06-19";
export const TODAY_KST = "2026-06-20";
export const DAY_BEFORE_KST = "2026-06-18";

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-01",
    email: "alice@example.com",
    emailVerifiedAt: null,
    displayName: "Alice",
    passwordHash: "$2a$10$dummy",
    role: "user",
    creditBalance: 100,
    isSuspended: false,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    streakCurrent: 0,
    streakLongest: 0,
    streakFreezes: 1,
    streakLastDay: null,
    ...overrides,
  };
}

export function makeMemo(overrides: Partial<Memo> = {}): Memo {
  return {
    id: "memo-01",
    userId: "user-01",
    dateKst: TODAY_KST,
    title: "오늘의 메모",
    charCount: 0,
    r2ObjectKey: "users/user-01/memos/memo-01.md.enc",
    encryptedDek: "ZmFrZQ==",
    dekAlgo: "aes-256-gcm",
    iv: "AAAAAAAAAAAAAAAA",
    bodySha256: null,
    isReadonly: false,
    readonlyAt: null,
    deletedAt: null,
    pinId: null,
    createdAt: "2026-06-20T00:00:00.000Z",
    updatedAt: "2026-06-20T00:00:00.000Z",
    ...overrides,
  };
}
