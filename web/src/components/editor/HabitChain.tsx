"use client";

import { Flame } from "lucide-react";

import type { ActivityGrid, StreakStatus } from "@/lib/api";
import { todayKst } from "@/lib/time";
import { cn } from "@/lib/utils";

/**
 * Inline habit chain — short identity statement at the top of the editor.
 *
 * - Streak 0: 정체성 first day prompt.
 * - Streak > 0: 🔥 N일 · 어제 ✓ · 그제 ✓ · 그그제 ✓ — 오늘은?
 *
 * 어제/그제/그그제 ✓ 표시는 활동 그리드 데이터에서 charCount >= 30 인 셀로만 표시.
 * 자정 1시간 전 (KST 23:00 이후) 끝에 "(자정 전!)" 약한 강조.
 */
export function HabitChain({
  streak,
  grid,
  className,
}: {
  streak: StreakStatus | null | undefined;
  grid: ActivityGrid | null | undefined;
  className?: string;
}) {
  if (!streak) return null;

  const isLateKst = isLateKstHour();
  const today = todayKst();

  // Compute up to 3 prior days (어제/그제/그그제) and their "written?" state.
  const priorLabels = ["어제", "그제", "그그제"] as const;
  const priorDates = [-1, -2, -3].map((d) => isoOffset(today, d));
  const cellsByDate = new Map<string, number>();
  if (grid) {
    for (const c of grid.cells) cellsByDate.set(c.date, c.charCount);
  }

  if (streak.current <= 0) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 text-sm text-muted-foreground",
          className,
        )}
        data-testid="habit-chain"
      >
        <span className="select-none" aria-hidden>
          ✨
        </span>
        <span>오늘이 첫날입니다 — 한 줄만 적어볼까요?</span>
      </div>
    );
  }

  return (
    <div
      className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-sm", className)}
      data-testid="habit-chain"
    >
      <span className="inline-flex items-center gap-1 font-semibold text-orange-500">
        <Flame className="h-3.5 w-3.5" aria-hidden />
        {streak.current}일
      </span>
      <span className="text-muted-foreground">·</span>
      {priorDates.map((d, i) => {
        const written = (cellsByDate.get(d) ?? 0) >= 30;
        return (
          <span
            key={d}
            className={cn(
              "inline-flex items-center gap-1",
              written ? "text-foreground" : "text-muted-foreground/60",
            )}
          >
            <span>{priorLabels[i]}</span>
            <span aria-hidden>{written ? "✓" : "·"}</span>
          </span>
        );
      })}
      <span className="text-muted-foreground">—</span>
      <span className="text-foreground">오늘은?</span>
      {isLateKst ? (
        <span className="ml-1 text-xs font-medium text-orange-500">(자정 전!)</span>
      ) : null}
    </div>
  );
}

/** ISO YYYY-MM-DD `today` shifted by `days` (negative = past). */
function isoOffset(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** True when the current KST clock hour is >= 23 (last hour before midnight). */
function isLateKstHour(now: Date = new Date()): boolean {
  const utcMs = now.getTime();
  const kst = new Date(utcMs + 9 * 60 * 60 * 1000);
  return kst.getUTCHours() >= 23;
}
