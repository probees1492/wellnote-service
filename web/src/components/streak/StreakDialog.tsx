"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { StreakStatus } from "@/lib/api";
import { MILESTONE_REWARDS } from "@/lib/streak";

interface StreakDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: StreakStatus | null;
  /** Optional fallback used while `status` is still loading. */
  fallbackCurrent?: number;
}

/**
 * Modal with the full streak overview: current count, motivating message,
 * progress toward next milestone, longest record, freeze count, and the
 * reward table with achieved milestones checked off.
 */
export function StreakDialog({
  open,
  onOpenChange,
  status,
  fallbackCurrent = 0,
}: StreakDialogProps) {
  const current = status?.current ?? fallbackCurrent;
  const longest = status?.longest ?? 0;
  const freezes = status?.freezes ?? 0;
  const nextMilestone = status?.nextMilestone ?? null;
  const daysToNext = status?.daysToNextMilestone ?? null;

  // Progress within [previousMilestone, nextMilestone]. Falls back to a
  // current/nextMilestone ratio when previous is unavailable.
  const progressPct = React.useMemo(() => {
    if (!nextMilestone) return 100;
    const prev = previousMilestone(nextMilestone);
    const start = prev ?? 0;
    const span = nextMilestone - start;
    if (span <= 0) return 0;
    const filled = Math.max(0, Math.min(span, current - start));
    return Math.round((filled / span) * 100);
  }, [current, nextMilestone]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        data-testid="streak-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <span aria-hidden>🔥</span>
            <span
              className={cn(
                "tabular-nums",
                current > 0 ? "text-orange-500" : "text-muted-foreground",
              )}
              data-testid="streak-dialog-current"
            >
              {current}일
            </span>
          </DialogTitle>
          <DialogDescription>
            {current === 0
              ? "오늘 메모를 시작하세요"
              : `오늘 메모를 작성하면 ${current + 1}일 달성!`}
          </DialogDescription>
        </DialogHeader>

        {nextMilestone != null ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                다음 마일스톤:{" "}
                <span className="font-semibold text-foreground">
                  {nextMilestone}일
                </span>
              </span>
              <span className="text-muted-foreground">
                남은{" "}
                <span className="font-semibold text-foreground">
                  {daysToNext ?? Math.max(0, nextMilestone - current)}일
                </span>
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              data-testid="streak-progress"
            >
              <div
                className="h-full rounded-full bg-orange-500 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            모든 마일스톤을 달성했어요. 멋져요!
          </p>
        )}

        <div className="flex items-center justify-between rounded-md border bg-card/50 px-3 py-2 text-sm">
          <span>
            최장 기록:{" "}
            <span className="font-semibold tabular-nums">{longest}일</span>
          </span>
          <span>
            동결권: <span aria-hidden>❄️</span>{" "}
            <span className="font-semibold tabular-nums">× {freezes}</span>
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium">보상표</div>
          <ul className="divide-y rounded-md border bg-card/50">
            {MILESTONE_REWARDS.map(([day, reward]) => {
              const achieved = current >= day;
              return (
                <li
                  key={day}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 text-sm",
                    achieved ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{day}일</span>
                    {achieved ? (
                      <span
                        aria-label="달성"
                        className="text-orange-500"
                      >
                        ✓
                      </span>
                    ) : null}
                  </span>
                  <span className="tabular-nums">+{reward}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function previousMilestone(target: number): number | null {
  let prev: number | null = null;
  for (const [d] of MILESTONE_REWARDS) {
    if (d >= target) break;
    prev = d;
  }
  return prev;
}
