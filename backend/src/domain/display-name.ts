/**
 * 필명 (display_name) validation policy — shared between signup and the
 * pre-check endpoint. Both must agree so the UI never accepts a value that the
 * server then rejects.
 *
 * Rules
 *  - length: 2..20 chars (after trim)
 *  - allowed: Korean syllables/jamo, Latin letters, digits, space, `_`, `-`, `.`
 *  - no leading/trailing whitespace, no control chars
 *  - must contain at least one letter or digit (not purely symbols/spaces)
 */

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 20;

const ALLOWED = /^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9 _\-.]+$/u;
const HAS_ALPHANUM = /[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9]/u;

export type DisplayNameReason =
  | "required"
  | "too_short"
  | "too_long"
  | "invalid_chars"
  | "taken";

export interface DisplayNameCheckOk {
  ok: true;
  value: string;
}
export interface DisplayNameCheckFail {
  ok: false;
  reason: Exclude<DisplayNameReason, "taken">;
}

/** Pure-format validation. Uniqueness is checked separately against the DB. */
export function validateDisplayName(
  raw: unknown,
): DisplayNameCheckOk | DisplayNameCheckFail {
  if (typeof raw !== "string") return { ok: false, reason: "required" };
  const v = raw.trim();
  if (v.length === 0) return { ok: false, reason: "required" };
  if (v.length < DISPLAY_NAME_MIN) return { ok: false, reason: "too_short" };
  if (v.length > DISPLAY_NAME_MAX) return { ok: false, reason: "too_long" };
  if (!ALLOWED.test(v)) return { ok: false, reason: "invalid_chars" };
  if (!HAS_ALPHANUM.test(v)) return { ok: false, reason: "invalid_chars" };
  return { ok: true, value: v };
}
