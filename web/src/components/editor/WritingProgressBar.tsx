"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import { todayKst } from "@/lib/time";

/**
 * Daily writing milestones (per character count). When the user crosses
 * one for the first time *today* we fire:
 *   - a 20 ms haptic on touch devices,
 *   - a one-shot toast via `onMilestone(label)`.
 * Dedupe is per-KST-day, persisted to localStorage.
 *
 * The 500-character ceiling drives the percent label that lives in the
 * editor's bottom-right corner.
 */
const MILESTONES = [
  { at: 30, label: "오늘 streak 확보 ✓" },
  { at: 100, label: "100자 — 한 단락 완성" },
  { at: 500, label: "500자 — 긴 호흡" },
] as const;

const MAX_BAR = 500;

function milestoneKey(today: string, at: number): string {
  return `wn:milestone:${today}:${at}`;
}

function useWritingMilestones(
  charCount: number,
  onMilestone?: (label: string) => void,
) {
  const lastFiredRef = useRef<Set<number>>(new Set());
  // Hydrate dedupe set from localStorage on mount.
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
  // Fire callback + persist whenever a new milestone is reached.
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
}

/**
 * Inline percent label for the editor's bottom-right corner.
 * Shows `0%` … `100%` against the 500-character ceiling. At 100% the
 * label switches to bold + foreground color to reward completion.
 * Side-effect: fires the writing milestone hook (toast + haptic) just
 * like the legacy progress bar used to.
 */
export function WritingProgressBar({
  charCount,
  onMilestone,
  className,
}: {
  charCount: number;
  onMilestone?: (label: string) => void;
  className?: string;
}) {
  useWritingMilestones(charCount, onMilestone);
  const percent = Math.min(100, Math.floor((charCount / MAX_BAR) * 100));
  const isFull = percent >= 100;
  return (
    <span
      className={cn(
        "tabular-nums",
        isFull
          ? "font-bold text-foreground"
          : "text-muted-foreground",
        className,
      )}
      data-testid="writing-progress"
      data-percent={percent}
      data-full={isFull ? "true" : "false"}
      title={`${charCount}/${MAX_BAR}자`}
      aria-label={`오늘의 글쓰기 진행 ${percent}%`}
    >
      {percent}%
    </span>
  );
}
