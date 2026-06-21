/**
 * Pin domain (cork-board pushpin metaphor).
 *
 * - A pin is a user-owned classification bucket for memos.
 * - A memo belongs to 0 or 1 pin (NOT m:n).
 * - Visibility is metadata only — used by future friend-share features.
 *   The backend never exposes one user's pins to another user yet.
 */

export type PinColor = "slate" | "yellow" | "red" | "green" | "blue";
export type PinVisibility = "private" | "public";

export interface Pin {
  id: string;
  userId: string;
  name: string;
  color: PinColor;
  visibility: PinVisibility;
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
  /** Set only by list/get APIs that compute it on demand. */
  memoCount?: number;
}

export const PIN_COLORS: readonly PinColor[] = [
  "slate",
  "yellow",
  "red",
  "green",
  "blue",
];

export const PIN_VISIBILITIES: readonly PinVisibility[] = [
  "private",
  "public",
];

export const PIN_NAME_MIN = 1;
export const PIN_NAME_MAX = 40;

export function isPinColor(x: unknown): x is PinColor {
  return typeof x === "string" && (PIN_COLORS as readonly string[]).includes(x);
}

export function isPinVisibility(x: unknown): x is PinVisibility {
  return (
    typeof x === "string" && (PIN_VISIBILITIES as readonly string[]).includes(x)
  );
}
