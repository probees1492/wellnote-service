"use client";

import { cn } from "@/lib/utils";
import { formatKoreanDate } from "@/lib/time";

/**
 * Top-of-editor date display, aesthetic-leaning:
 *
 *   "6월 21일"  (large 명조체)
 *   "토요일 · 2026"  (small caption — Saturday in sky-blue, Sunday in rose,
 *                    matching the activity grid week-axis convention)
 *
 * The big line uses font-serif to evoke a handwritten diary heading.
 */
export function DateHeading({
  iso,
  className,
}: {
  iso: string;
  className?: string;
}) {
  const { month, day, weekdayIndex, weekdayLong, year } = formatKoreanDate(iso);
  const weekdayColor =
    weekdayIndex === 6
      ? "text-sky-500"
      : weekdayIndex === 0
        ? "text-rose-500"
        : "text-muted-foreground";

  return (
    <div className={cn("flex flex-col gap-1", className)} data-testid="date-heading">
      <h1 className="font-serif text-3xl font-semibold tracking-tight leading-none">
        {month}월 {day}일
      </h1>
      <p className="flex items-center gap-2 text-sm">
        <span className={cn("font-medium", weekdayColor)}>{weekdayLong}</span>
        <span aria-hidden className="text-muted-foreground">
          ·
        </span>
        <span className="text-muted-foreground">{year}년</span>
      </p>
    </div>
  );
}
