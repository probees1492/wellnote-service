"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import { todayKst } from "@/lib/time";

/**
 * Top-of-editor progress bar tied to the daily writing milestones.
 *
 * Milestones: 30 (streak 확보), 100 (한 단락 완성), 500 (긴 호흡).
 * When the user crosses a milestone for the first time today we trigger:
 *  - a short haptic on touch devices (`navigator.vibrate?.(20)`),
 *  - a one-shot toast via the optional `onMilestone(label)` callback.
 *
 * Per-day dedupe lives in localStorage so refreshing or revisiting later in
 * the day does not re-fire the toasts.
 */
const MILESTONES = [
  { at: 30, label: "오늘 streak 확보 ✓" },
  { at: 100, label: "100자 — 한 단락 완성" },
  { at: 500, label: "500자 — 긴 호흡" },
] as const;

const MAX_BAR = 500;

export function WritingProgressBar({
  charCount,
  onMilestone,
  className,
}: {
  charCount: number;
  onMilestone?: (label: string) => void;
  className?: string;
}) {
  const lastFiredRef = useRef<Set<number>>(new Set());

  // Hydrate dedupe set from localStorage once on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const today = todayKst();
    const next = new Set<number>();
    for (const m of MILESTONES) {
      try {
        if (window.localStorage.getItem(milestoneKey(today, m.at))) {
          next.add(m.at);
        }
      } catch {
        /* ignore */
      }
    }
    lastFiredRef.current = next;
  }, []);

  // Fire callbacks + persist when a new milestone is reached.
  useEffect(() => {
    const today = todayKst();
    for (const m of MILESTONES) {
      if (charCount >= m.at && !lastFiredRef.current.has(m.at)) {
        lastFiredRef.current.add(m.at);
        try {
          window.localStorage.setItem(milestoneKey(today, m.at), "1");
        } catch {
          /* ignore */
        }
        try {
          navigator.vibrate?.(20);
        } catch {
          /* ignore */
        }
        onMilestone?.(m.label);
      }
    }
  }, [charCount, onMilestone]);

  const percent = Math.min(100, (charCount / MAX_BAR) * 100);

  return (
    <div
      className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      data-testid="writing-progress"
      aria-label="오늘의 글쓰기 진행"
      role="progressbar"
      aria-valuenow={Math.min(charCount, MAX_BAR)}
      aria-valuemin={0}
      aria-valuemax={MAX_BAR}
    >
      <div
        className="h-full rounded-full bg-orange-500 transition-[width] duration-200 ease-out"
        style={{ width: `${percent}%` }}
      />
      {/* Milestone tick marks */}
      {MILESTONES.map((m) => (
        <span
          key={m.at}
          aria-hidden
          className={cn(
            "absolute top-1/2 h-2 w-px -translate-y-1/2 bg-foreground/30",
            charCount >= m.at && "bg-orange-500/80",
          )}
          style={{ left: `${(m.at / MAX_BAR) * 100}%` }}
          title={`${m.at}자`}
        />
      ))}
    </div>
  );
}

function milestoneKey(today: string, at: number): string {
  return `wn:milestone:${today}:${at}`;
}
