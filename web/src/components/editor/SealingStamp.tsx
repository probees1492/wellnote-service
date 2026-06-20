"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

interface SealingStampProps {
  /** Milliseconds remaining until KST midnight (-1 or 0 once sealed). */
  msRemaining: number;
  /** Fired once when the seal animation finishes — parent should reload. */
  onSealed?: () => void;
  className?: string;
}

/**
 * Two-phase sealing UI:
 *
 *   1. When `msRemaining` <= 30s and > 0 -> large countdown badge
 *      (e.g. "00:00:23") in the corner.
 *   2. When `msRemaining` <= 0 -> red "封" stamp animation (~800ms),
 *      then `onSealed` fires so the parent can flip to readonly.
 *
 * Rendered absolutely positioned over the editor card.
 */
export function SealingStamp({
  msRemaining,
  onSealed,
  className,
}: SealingStampProps) {
  const [sealed, setSealed] = useState(false);

  // Trigger the stamp animation exactly once when crossing zero.
  useEffect(() => {
    if (sealed) return;
    if (msRemaining > 0) return;
    setSealed(true);
    const id = window.setTimeout(() => {
      onSealed?.();
    }, 850);
    return () => window.clearTimeout(id);
  }, [msRemaining, onSealed, sealed]);

  // Phase 1: last 30 seconds — show big countdown.
  if (!sealed && msRemaining > 0 && msRemaining <= 30_000) {
    const totalSec = Math.max(0, Math.ceil(msRemaining / 1000));
    const hh = String(Math.floor(totalSec / 3600)).padStart(2, "0");
    const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
    const ss = String(totalSec % 60).padStart(2, "0");
    return (
      <div
        className={cn(
          "pointer-events-none absolute right-4 top-4 z-20 select-none",
          "rounded-md bg-destructive/10 px-3 py-1.5 text-sm font-semibold tabular-nums text-destructive",
          "shadow-sm ring-1 ring-destructive/30 animate-pulse",
          className,
        )}
        data-testid="seal-final-countdown"
      >
        {hh}:{mm}:{ss}
      </div>
    );
  }

  if (!sealed) return null;

  // Phase 2: the stamp.
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-30 flex items-center justify-center",
        className,
      )}
      data-testid="sealing-stamp"
      aria-hidden
    >
      <svg
        width="180"
        height="180"
        viewBox="0 0 180 180"
        className="animate-[wn-stamp_800ms_cubic-bezier(.2,.9,.3,1.2)_forwards] opacity-0"
        style={{ transformOrigin: "center" }}
      >
        <rect
          x="14"
          y="14"
          width="152"
          height="152"
          rx="10"
          fill="none"
          stroke="#c1272d"
          strokeWidth="6"
          opacity="0.92"
        />
        <rect
          x="22"
          y="22"
          width="136"
          height="136"
          rx="6"
          fill="none"
          stroke="#c1272d"
          strokeWidth="2"
          opacity="0.7"
        />
        <text
          x="90"
          y="118"
          textAnchor="middle"
          fontSize="104"
          fontFamily='"Noto Serif KR","Nanum Myeongjo",serif'
          fontWeight="700"
          fill="#c1272d"
          opacity="0.95"
        >
          封
        </text>
      </svg>
    </div>
  );
}
