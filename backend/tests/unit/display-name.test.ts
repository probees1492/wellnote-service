import { describe, it, expect } from "vitest";
import { validateDisplayName } from "../../src/domain/display-name";

describe("validateDisplayName (필명 정책)", () => {
  it("accepts a typical Korean pen name", () => {
    const r = validateDisplayName("필명-2026");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("필명-2026");
  });

  it("trims surrounding whitespace", () => {
    const r = validateDisplayName("  Pen Name  ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("Pen Name");
  });

  it("rejects empty / missing input", () => {
    expect(validateDisplayName("")).toEqual({ ok: false, reason: "required" });
    expect(validateDisplayName("   ")).toEqual({
      ok: false,
      reason: "required",
    });
    expect(validateDisplayName(undefined)).toEqual({
      ok: false,
      reason: "required",
    });
  });

  it("rejects too short / too long", () => {
    expect(validateDisplayName("A")).toEqual({
      ok: false,
      reason: "too_short",
    });
    expect(validateDisplayName("x".repeat(21))).toEqual({
      ok: false,
      reason: "too_long",
    });
  });

  it("rejects unsupported characters", () => {
    expect(validateDisplayName("hey!")).toEqual({
      ok: false,
      reason: "invalid_chars",
    });
    expect(validateDisplayName("a/b")).toEqual({
      ok: false,
      reason: "invalid_chars",
    });
    expect(validateDisplayName("--")).toEqual({
      ok: false,
      reason: "invalid_chars",
    });
  });
});
