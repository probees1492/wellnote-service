"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { api, type StreakStatus } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";

import { StreakDialog } from "./StreakDialog";

interface StreakBadgeProps {
  /** Optional pre-fetched status. When omitted, the badge fetches lazily on
   *  mount so it works standalone in any page. */
  status?: StreakStatus | null;
}

/**
 * Compact 🔥 + day-count badge used in the header. Clicking opens the
 * StreakDialog with full detail. Falls back to the user object's
 * `streakCurrent` field when no live status is available yet.
 */
export function StreakBadge({ status: statusProp }: StreakBadgeProps) {
  const user = useAuth((s) => s.user);
  const [status, setStatus] = React.useState<StreakStatus | null>(
    statusProp ?? null,
  );
  const [open, setOpen] = React.useState(false);

  // Keep local state in sync with explicit prop updates from parents that
  // already own the fetch (e.g. the home page).
  React.useEffect(() => {
    if (statusProp !== undefined) setStatus(statusProp);
  }, [statusProp]);

  // Only fetch ourselves when the parent did not pass anything in. We rely on
  // `user` to gate the call so unauthenticated routes never hit /streak.
  React.useEffect(() => {
    if (statusProp !== undefined) return;
    if (!user) return;
    let alive = true;
    (async () => {
      try {
        const s = await api.streakStatus();
        if (alive) setStatus(s);
      } catch {
        // Silent — the badge degrades to the cached user.streakCurrent value.
      }
    })();
    return () => {
      alive = false;
    };
  }, [statusProp, user?.id]);

  if (!user) return null;

  const current = status?.current ?? user.streakCurrent ?? 0;
  const isActive = current > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`연속 작성 ${current}일 — 자세히 보기`}
        data-testid="streak-badge"
        data-current={current}
        className={cn(
          "inline-flex h-9 items-center gap-1 rounded-md px-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isActive ? "text-orange-500" : "text-muted-foreground",
        )}
      >
        <span aria-hidden className="text-base leading-none">
          🔥
        </span>
        <span className="tabular-nums">{current}</span>
      </button>
      <StreakDialog
        open={open}
        onOpenChange={setOpen}
        status={status}
        fallbackCurrent={current}
      />
    </>
  );
}
