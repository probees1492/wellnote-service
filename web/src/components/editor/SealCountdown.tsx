"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Returns the number of milliseconds remaining until the next KST midnight.
 * KST is UTC+9, so we shift `now` by +9h and compute the delta to its
 * next UTC-aligned midnight, then shift back.
 */
function msUntilKstMidnight(now: Date = new Date()): number {
  const utcMs = now.getTime();
  const kstMs = utcMs + 9 * 60 * 60 * 1000;
  const kst = new Date(kstMs);
  const nextKstMidnightUtcAligned = Date.UTC(
    kst.getUTCFullYear(),
    kst.getUTCMonth(),
    kst.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  return nextKstMidnightUtcAligned - kstMs;
}

interface SealCountdownProps {
  /** When true (default), renders the countdown copy in the corner. */
  visible?: boolean;
  className?: string;
  /** Bubbled up so parent can show last-30s big countdown / trigger stamp. */
  onTick?: (msRemaining: number) => void;
}

/**
 * Soft countdown to KST midnight. Updates once a second so the parent can
 * react to the last-30s sealing window; the visible text recomputes its
 * "Xh Ym" label only when minutes change.
 */
export function SealCountdown({
  visible = true,
  className,
  onTick,
}: SealCountdownProps) {
  const [ms, setMs] = useState<number>(() => msUntilKstMidnight());

  useEffect(() => {
    let raf: number | null = null;
    const tick = () => {
      const remaining = msUntilKstMidnight();
      setMs(remaining);
      onTick?.(remaining);
    };
    tick();
    // 1Hz is sufficient — parent handles per-second logic during last 30s.
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(id);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [onTick]);

  if (!visible) return null;

  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  // Warmth ramps up as midnight approaches; 0 at >6h out, 1 at <30min.
  const warmth = Math.max(
    0,
    Math.min(1, 1 - (totalSeconds - 30 * 60) / (6 * 60 * 60 - 30 * 60)),
  );

  const label =
    hours > 0
      ? `자정까지 ${hours}시간 ${minutes}분`
      : minutes > 0
        ? `자정까지 ${minutes}분`
        : `잠시 후 봉인됩니다`;

  return (
    <div
      className={cn(
        "pointer-events-none select-none text-[11px] font-medium text-muted-foreground/80",
        className,
      )}
      data-testid="seal-countdown"
      style={{
        // Subtle warm tint that grows with `warmth`.
        color: `hsla(28, ${30 + warmth * 40}%, ${45 - warmth * 10}%, ${0.55 + warmth * 0.35})`,
      }}
      aria-live="polite"
    >
      <span aria-hidden>🕯</span>{" "}
      <span>{label}</span>
      <span className="ml-1 hidden sm:inline">
        — 그 후 오늘의 일기는 봉인됩니다
      </span>
    </div>
  );
}

export { msUntilKstMidnight };
