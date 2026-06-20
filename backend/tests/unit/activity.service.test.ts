import { describe, it, expect } from "vitest";
import { DefaultActivityService } from "../../src/services/activity.service";
import type { MemoRepo } from "../../src/repositories/memo.repo";
import { NOW } from "../helpers/fixtures";

function makeService() {
  const memos: MemoRepo = {} as unknown as MemoRepo;
  return new DefaultActivityService(memos);
}

describe("ActivityService.getGrid", () => {
  it("returns 364 cells by default (52 weeks * 7 days)", async () => {
    const svc = makeService();
    const grid = await svc.getGrid({ userId: "user-1", now: NOW });
    expect(grid.cells).toHaveLength(364);
  });

  it("default 'to' is todayKst(now)", async () => {
    const svc = makeService();
    const grid = await svc.getGrid({ userId: "user-1", now: NOW });
    expect(grid.to).toBe("2026-06-20");
  });

  it("returns empty days with level 0 when user has no memos", async () => {
    const svc = makeService();
    const grid = await svc.getGrid({ userId: "user-no-memos", now: NOW });
    expect(grid.cells.every((c) => c.level === 0)).toBe(true);
    expect(grid.cells.every((c) => c.charCount === 0)).toBe(true);
    expect(grid.cells.every((c) => c.memoId === null)).toBe(true);
  });

  it("respects custom from/to range", async () => {
    const svc = makeService();
    const grid = await svc.getGrid({
      userId: "user-1",
      from: "2026-06-15",
      to: "2026-06-20",
    });
    expect(grid.cells).toHaveLength(6);
    expect(grid.cells[0].date).toBe("2026-06-15");
    expect(grid.cells[grid.cells.length - 1].date).toBe("2026-06-20");
  });
});
