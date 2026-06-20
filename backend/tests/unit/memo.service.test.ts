import { describe, it, expect, beforeEach } from "vitest";
import { DefaultMemoService } from "../../src/services/memo.service";
import {
  ReadOnlyMemoError,
  NotFoundError,
  PayloadTooLargeError,
  InsufficientCreditsError,
} from "../../src/lib/errors";
import { MAX_MEMO_CHARS, activityLevelFromCharCount } from "../../src/domain/memo";
import type { MemoRepo } from "../../src/repositories/memo.repo";
import type { UserRepo } from "../../src/repositories/user.repo";
import type { CryptoService } from "../../src/services/crypto.service";
import type { StorageService } from "../../src/services/storage.service";
import { makeMemo, makeUser, TODAY_KST, YESTERDAY_KST, NOW } from "../helpers/fixtures";

function makeService() {
  const memos: MemoRepo = {} as unknown as MemoRepo;
  const users: UserRepo = {} as unknown as UserRepo;
  const crypto: CryptoService = {} as unknown as CryptoService;
  const storage: StorageService = {} as unknown as StorageService;
  return new DefaultMemoService(memos, users, crypto, storage);
}

describe("MemoService", () => {
  let service: ReturnType<typeof makeService>;
  beforeEach(() => {
    service = makeService();
  });

  it("getOrCreateToday creates a new empty memo when none exists for the KST date", async () => {
    const memo = await service.getOrCreateToday({ userId: "user-1", now: NOW });
    expect(memo.userId).toBe("user-1");
    expect(memo.dateKst).toBe(TODAY_KST);
    expect(memo.charCount).toBe(0);
    expect(memo.body).toBe("");
    expect(memo.isReadonly).toBe(false);
  });

  it("update succeeds for today's memo", async () => {
    const memo = await service.update({
      userId: "user-1",
      memoId: "memo-today",
      body: "오늘의 회고",
      now: NOW,
    });
    expect(memo.charCount).toBe("오늘의 회고".length);
    expect(memo.isReadonly).toBe(false);
  });

  it("update rejects yesterday's memo with ReadOnlyMemoError", async () => {
    // Implementation should detect memo.dateKst === YESTERDAY_KST != todayKst(now)
    await expect(
      service.update({
        userId: "user-1",
        memoId: "memo-yesterday",
        body: "수정 시도",
        now: NOW,
      }),
    ).rejects.toBeInstanceOf(ReadOnlyMemoError);
  });

  it("getById throws NotFoundError if memo doesn't exist", async () => {
    await expect(
      service.getById({ userId: "user-1", memoId: "missing" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("update rejects body over 100,000 chars with PayloadTooLargeError", async () => {
    const huge = "a".repeat(MAX_MEMO_CHARS + 1);
    await expect(
      service.update({
        userId: "user-1",
        memoId: "memo-today",
        body: huge,
        now: NOW,
      }),
    ).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  it("enforces one-memo-per-day: second getOrCreateToday returns the same memo id", async () => {
    const a = await service.getOrCreateToday({ userId: "user-1", now: NOW });
    const b = await service.getOrCreateToday({ userId: "user-1", now: NOW });
    expect(a.id).toBe(b.id);
  });

  it("assertReadable throws InsufficientCreditsError when memo is readonly and balance < 1", async () => {
    const user = makeUser({ creditBalance: 0 });
    const memo = makeMemo({ isReadonly: true, dateKst: YESTERDAY_KST });
    await expect(service.assertReadable({ userId: user.id, memo })).rejects.toBeInstanceOf(
      InsufficientCreditsError,
    );
  });
});

describe("activityLevelFromCharCount", () => {
  it.each([
    [0, 0],
    [1, 1],
    [99, 1],
    [100, 2],
    [499, 2],
    [500, 3],
    [1499, 3],
    [1500, 4],
    [99999, 4],
  ])("charCount %i -> level %i", (chars, level) => {
    expect(activityLevelFromCharCount(chars)).toBe(level);
  });
});
