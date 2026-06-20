"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { StreakStatus } from "@/lib/api";
import {
  LAST_SEEN_MILESTONE_KEY,
  MILESTONE_DAYS,
  milestoneReward,
} from "@/lib/streak";

interface MilestoneCelebrationProps {
  status: StreakStatus | null;
}

/**
 * Detects a freshly-hit milestone via a localStorage-backed heuristic and
 * pops a celebratory dialog with confetti. Designed to live alongside any
 * page (or layout) — it renders nothing when no celebration is due.
 *
 * Heuristic: when `status.current` is one of MILESTONE_DAYS and strictly
 * greater than the last value persisted under LAST_SEEN_MILESTONE_KEY, we
 * show the modal and bump the stored value. A user therefore sees the modal
 * at most once per milestone (even across reloads), and never re-sees an
 * earlier milestone after their streak resets.
 */
export function MilestoneCelebration({ status }: MilestoneCelebrationProps) {
  const [open, setOpen] = React.useState(false);
  const [reachedDay, setReachedDay] = React.useState<number | null>(null);
  const reward = reachedDay != null ? milestoneReward(reachedDay) ?? 0 : 0;

  React.useEffect(() => {
    if (!status) return;
    if (typeof window === "undefined") return;
    const cur = status.current;
    if (!MILESTONE_DAYS.has(cur)) return;
    let lastSeen = 0;
    try {
      const raw = window.localStorage.getItem(LAST_SEEN_MILESTONE_KEY);
      lastSeen = raw ? Number(raw) || 0 : 0;
    } catch {
      lastSeen = 0;
    }
    if (cur <= lastSeen) return;
    setReachedDay(cur);
    setOpen(true);
    try {
      window.localStorage.setItem(LAST_SEEN_MILESTONE_KEY, String(cur));
    } catch {
      /* ignore */
    }
    // Lazy-load confetti so it never bloats the initial bundle for users
    // who never reach a milestone in a given session.
    (async () => {
      try {
        const mod = await import("canvas-confetti");
        const confetti = mod.default;
        // Two staggered bursts for a fuller effect.
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#f97316", "#fb923c", "#fdba74", "#fff7ed"],
        });
        setTimeout(() => {
          confetti({
            particleCount: 80,
            spread: 100,
            startVelocity: 35,
            origin: { y: 0.5 },
            colors: ["#f97316", "#fb923c", "#fbbf24"],
          });
        }, 250);
      } catch {
        /* confetti is best-effort */
      }
    })();
  }, [status?.current]);

  if (reachedDay == null) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-md text-center"
        data-testid="milestone-dialog"
      >
        <DialogHeader>
          <DialogTitle className="text-center text-3xl text-orange-500">
            <span aria-hidden>🔥</span> {reachedDay}일
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            {reachedDay}일 연속 달성! +{reward} 크레딧
          </DialogDescription>
        </DialogHeader>
        {status?.nextMilestone ? (
          <p className="text-sm text-muted-foreground">
            다음 목표는 {status.nextMilestone}일!
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            모든 마일스톤을 달성했어요. 정말 멋져요!
          </p>
        )}
        <DialogFooter className="sm:justify-center">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            data-testid="milestone-later"
          >
            다음에 보기
          </Button>
          <Button
            onClick={() => setOpen(false)}
            data-testid="milestone-ok"
          >
            확인
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
