"use client";

import { cn } from "@/lib/utils";
import type { ActivityCell, ActivityGrid as GridT } from "@/lib/api";

const LEVEL_BG = [
  "bg-grid-empty",
  "bg-grid-l1",
  "bg-grid-l2",
  "bg-grid-l3",
  "bg-grid-l4",
] as const;

const DOW_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

function dayOfWeekMondayFirst(iso: string): number {
  // 0 = Mon, 6 = Sun
  const d = new Date(iso + "T00:00:00Z");
  const w = d.getUTCDay(); // 0=Sun..6=Sat
  return (w + 6) % 7;
}

function monthOf(iso: string): number {
  // 1..12 (UTC)
  return Number(iso.slice(5, 7));
}

export function ActivityGrid({
  grid,
  todayIso,
  onCellClick,
}: {
  grid: GridT | null;
  todayIso: string;
  onCellClick?: (cell: ActivityCell) => void;
}) {
  if (!grid) {
    return (
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground shadow-sm">
        활동 그리드를 불러오는 중...
      </div>
    );
  }

  const cells = grid.cells;
  if (cells.length === 0) return null;
  const firstDow = dayOfWeekMondayFirst(cells[0].date);
  const cols: (ActivityCell | null)[][] = [];
  let col: (ActivityCell | null)[] = Array.from(
    { length: firstDow },
    () => null,
  );
  for (const c of cells) {
    col.push(c);
    if (col.length === 7) {
      cols.push(col);
      col = [];
    }
  }
  if (col.length > 0) {
    while (col.length < 7) col.push(null);
    cols.push(col);
  }

  // Month label per column: only set when the month changes vs the prior column.
  // We use the first non-null cell in the column as the column's reference date.
  const monthLabels: (string | null)[] = [];
  let prevMonth = -1;
  for (const column of cols) {
    const first = column.find((c) => c !== null) as ActivityCell | undefined;
    if (!first) {
      monthLabels.push(null);
      continue;
    }
    const m = monthOf(first.date);
    if (m !== prevMonth) {
      monthLabels.push(`${m}월`);
      prevMonth = m;
    } else {
      monthLabels.push(null);
    }
  }

  return (
    <div
      className="overflow-x-auto rounded-lg border bg-card p-4 shadow-sm"
      data-testid="activity-grid"
    >
      <div className="flex gap-[3px]">
        {/* Left column: day-of-week labels (Sat=blue, Sun=red) */}
        <div className="mr-1 flex flex-col gap-[3px] pt-[18px]">
          {DOW_LABELS.map((label, i) => (
            <div
              key={label}
              className={cn(
                "flex h-3 w-5 items-center justify-end text-[10px] leading-none",
                i === 5
                  ? "font-semibold text-sky-500"
                  : i === 6
                    ? "font-semibold text-rose-500"
                    : "text-muted-foreground",
              )}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Columns of cells with month label row on top */}
        <div className="flex gap-[3px]">
          {cols.map((column, ci) => (
            <div key={ci} className="flex flex-col gap-[3px]">
              <div className="h-[14px] text-[10px] font-medium leading-none text-muted-foreground">
                {monthLabels[ci] ?? ""}
              </div>
              {column.map((cell, ri) => {
                if (!cell) {
                  return (
                    <div
                      key={ri}
                      className="h-3 w-3 rounded-[2px] bg-transparent"
                    />
                  );
                }
                const isToday = cell.date === todayIso;
                return (
                  <button
                    key={ri}
                    type="button"
                    onClick={() => onCellClick?.(cell)}
                    title={`${cell.date} · ${cell.charCount}자`}
                    data-testid={
                      isToday ? "grid-cell-today" : `grid-cell-${cell.date}`
                    }
                    data-date={cell.date}
                    data-level={cell.level}
                    className={cn(
                      "h-3 w-3 cursor-pointer rounded-[2px]",
                      LEVEL_BG[cell.level],
                      isToday
                        ? "ring-2 ring-ring ring-offset-1 ring-offset-background"
                        : "hover:outline hover:outline-1 hover:outline-ring",
                    )}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span>적게</span>
        {[0, 1, 2, 3, 4].map((lv) => (
          <span
            key={lv}
            className={cn(
              "inline-block h-3 w-3 rounded-[2px]",
              LEVEL_BG[lv as 0 | 1 | 2 | 3 | 4],
            )}
          />
        ))}
        <span>많이</span>
      </div>
    </div>
  );
}
