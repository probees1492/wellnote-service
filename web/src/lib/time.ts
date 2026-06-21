/** Compute today in KST as YYYY-MM-DD. */
export function todayKst(now: Date = new Date()): string {
  // KST = UTC+9
  const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const kst = new Date(utc + 9 * 60 * 60 * 1000);
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(kst.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Add (or subtract) calendar days to an ISO date and return YYYY-MM-DD. */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Korean weekday labels — 0=Sun..6=Sat (matches Date.getUTCDay). */
export const WEEKDAY_KR = ["일", "월", "화", "수", "목", "금", "토"] as const;

/**
 * Format an ISO timestamp as a Korean relative-time label
 * (e.g. "방금", "3분 전", "2시간 전", "어제", "3일 전", "2024-01-05").
 */
export function formatRelativeKorean(
  iso: string,
  now: Date = new Date(),
): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const diffMs = now.getTime() - t;
  if (diffMs < 0) return "방금";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "방금";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "어제";
  if (day < 7) return `${day}일 전`;
  // Older than a week: render the calendar date.
  const d = new Date(t);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Decompose a YYYY-MM-DD into Korean-friendly display parts. */
export function formatKoreanDate(iso: string): {
  year: number;
  month: number;
  day: number;
  weekdayIndex: number;
  weekdayShort: string;
  weekdayLong: string;
} {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const idx = dt.getUTCDay();
  return {
    year: y,
    month: m,
    day: d,
    weekdayIndex: idx,
    weekdayShort: WEEKDAY_KR[idx],
    weekdayLong: `${WEEKDAY_KR[idx]}요일`,
  };
}
