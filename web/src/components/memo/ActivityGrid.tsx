"use client";

import clsx from "clsx";
import type { ActivityCell, ActivityGrid as GridT } from "@/lib/api";

const LEVEL_BG = [
  "bg-grid-empty",
  "bg-grid-l1",
  "bg-grid-l2",
  "bg-grid-l3",
  "bg-grid-l4",
] as const;

function dayOfWeekMondayFirst(iso: string): number {
  // 0 = Mon, 6 = Sun
  const d = new Date(iso + "T00:00:00Z");
  const w = d.getUTCDay(); // 0=Sun..6=Sat
  return (w + 6) % 7;
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
      <div className="rounded-md border border-border bg-bg-secondary p-6 text-sm text-text-muted">
        활동 그리드를 불러오는 중...
      </div>
    );
  }

  // Pack cells into 7-row columns (one column = 1 week, starting on Monday)
  // Pad the first column with leading nulls so the first row corresponds to Monday.
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

  return (
    <div
      className="overflow-x-auto rounded-lg border border-border bg-bg-primary p-4"
      data-testid="activity-grid"
    >
      <div className="flex gap-[3px]">
        {cols.map((column, ci) => (
          <div key={ci} className="flex flex-col gap-[3px]">
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
                  className={clsx(
                    "h-3 w-3 rounded-[2px] cursor-pointer",
                    LEVEL_BG[cell.level],
                    isToday
                      ? "ring-2 ring-edge-blue ring-offset-1"
                      : "hover:outline hover:outline-1 hover:outline-edge-blue",
                  )}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
        <span>적게</span>
        {[0, 1, 2, 3, 4].map((lv) => (
          <span
            key={lv}
            className={clsx(
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
