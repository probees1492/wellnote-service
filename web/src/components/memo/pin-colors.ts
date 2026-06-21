// Centralised pin-color tokens. The card body itself is always cream/white;
// color is only applied to the pushpin head and the small swatch in the
// memo "pin attached" pill.
import type { PinColor } from "@/lib/api";

export const PIN_COLORS: Record<PinColor, string> = {
  slate: "slate",
  yellow: "yellow",
  red: "red",
  green: "green",
  blue: "blue",
};

/** Background class for the round pushpin head. Tailwind-safelist friendly. */
export const PIN_COLOR_HEAD_CLASS: Record<PinColor, string> = {
  slate: "bg-slate-500",
  yellow: "bg-yellow-500",
  red: "bg-red-500",
  green: "bg-green-500",
  blue: "bg-blue-500",
};

/** Small text label per color (for accessible names). */
export const PIN_COLOR_LABEL: Record<PinColor, string> = {
  slate: "슬레이트",
  yellow: "노랑",
  red: "빨강",
  green: "초록",
  blue: "파랑",
};

/** Rotation cycle for "pinned to corkboard" feel. */
export const PIN_ROTATIONS = [
  "rotate-[-2deg]",
  "rotate-[1deg]",
  "rotate-[-1deg]",
  "rotate-[2deg]",
  "rotate-0",
];

export function rotationForIndex(i: number): string {
  return PIN_ROTATIONS[i % PIN_ROTATIONS.length];
}
