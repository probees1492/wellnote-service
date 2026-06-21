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
