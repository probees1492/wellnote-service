import { describe, it, expect } from "vitest";
import {
  COMMENT_MAX,
  isAllowedEmoji,
  sanitizeComment,
} from "../../src/domain/memo-interaction";

describe("isAllowedEmoji", () => {
  it("accepts a single emoji codepoint", () => {
    expect(isAllowedEmoji("👍")).toBe(true);
    expect(isAllowedEmoji("❤️")).toBe(true);
    expect(isAllowedEmoji("🔥")).toBe(true);
    expect(isAllowedEmoji("😀")).toBe(true);
  });

  it("accepts emoji with ZWJ sequence prefix", () => {
    expect(isAllowedEmoji("👨‍👩‍👧")).toBe(true);
  });

  it("rejects ASCII / Hangul / arbitrary text", () => {
    expect(isAllowedEmoji("ok")).toBe(false);
    expect(isAllowedEmoji("좋아요")).toBe(false);
    expect(isAllowedEmoji(":+1:")).toBe(false);
    expect(isAllowedEmoji("")).toBe(false);
  });

  it("rejects long strings even when they contain emoji", () => {
    expect(isAllowedEmoji("👍".repeat(20))).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isAllowedEmoji(null)).toBe(false);
    expect(isAllowedEmoji(undefined)).toBe(false);
    expect(isAllowedEmoji(42)).toBe(false);
  });
});

describe(`sanitizeComment (cap ${COMMENT_MAX} chars)`, () => {
  it("trims whitespace and accepts short text", () => {
    expect(sanitizeComment("  좋네  ")).toBe("좋네");
  });

  it(`rejects strings over ${COMMENT_MAX} chars`, () => {
    expect(sanitizeComment("가".repeat(COMMENT_MAX + 1))).toBeNull();
  });

  it("rejects empty / whitespace-only", () => {
    expect(sanitizeComment("")).toBeNull();
    expect(sanitizeComment("   ")).toBeNull();
  });

  it("rejects newlines and control chars", () => {
    expect(sanitizeComment("multi\nline")).toBeNull();
    expect(sanitizeComment("tab\there")).toBeNull();
  });

  it("accepts an emoji-only comment", () => {
    expect(sanitizeComment("👍")).toBe("👍");
  });
});
