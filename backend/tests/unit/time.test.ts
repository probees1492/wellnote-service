import { describe, it, expect } from "vitest";
import {
  toDateKst,
  todayKst,
  previousDateKst,
  nextDateKst,
  startOfKstDayUtc,
  enumerateKstDates,
} from "../../src/lib/time";

describe("time utils (KST)", () => {
  describe("toDateKst", () => {
    it("returns 2026-06-19 for UTC 2026-06-19T14:59:59Z (KST 23:59:59 same day)", () => {
      expect(toDateKst("2026-06-19T14:59:59Z")).toBe("2026-06-19");
    });

    it("returns 2026-06-20 for UTC 2026-06-19T15:00:00Z (KST 00:00:00 next day)", () => {
      expect(toDateKst("2026-06-19T15:00:00Z")).toBe("2026-06-20");
    });

    it("returns 2026-06-20 for UTC 2026-06-20T14:00:00Z (KST 23:00 same day)", () => {
      expect(toDateKst("2026-06-20T14:00:00Z")).toBe("2026-06-20");
    });

    it("handles year boundary: UTC 2025-12-31T15:00:00Z -> 2026-01-01 KST", () => {
      expect(toDateKst("2025-12-31T15:00:00Z")).toBe("2026-01-01");
    });
  });

  describe("todayKst", () => {
    it("delegates to toDateKst with the current instant", () => {
      const fixed = new Date("2026-06-19T15:00:00Z");
      expect(todayKst(fixed)).toBe("2026-06-20");
    });
  });

  describe("previousDateKst / nextDateKst", () => {
    it("previous of 2026-06-01 is 2026-05-31", () => {
      expect(previousDateKst("2026-06-01")).toBe("2026-05-31");
    });
    it("next of 2026-02-28 is 2026-03-01 (non-leap)", () => {
      expect(nextDateKst("2026-02-28")).toBe("2026-03-01");
    });
    it("next of 2024-02-28 is 2024-02-29 (leap)", () => {
      expect(nextDateKst("2024-02-28")).toBe("2024-02-29");
    });
  });

  describe("startOfKstDayUtc", () => {
    it("KST 2026-06-20 starts at UTC 2026-06-19T15:00:00.000Z", () => {
      expect(startOfKstDayUtc("2026-06-20")).toBe("2026-06-19T15:00:00.000Z");
    });
  });

  describe("enumerateKstDates", () => {
    it("returns inclusive range of dates", () => {
      expect(enumerateKstDates("2026-06-18", "2026-06-20")).toEqual([
        "2026-06-18",
        "2026-06-19",
        "2026-06-20",
      ]);
    });
    it("returns a 364-length array for a 364-day window", () => {
      // Inclusive [from, to] of 364 days → from = to - 363 days.
      const list = enumerateKstDates("2025-06-21", "2026-06-19");
      expect(list).toHaveLength(364);
      expect(list[0]).toBe("2025-06-21");
      expect(list[list.length - 1]).toBe("2026-06-19");
    });
  });
});
