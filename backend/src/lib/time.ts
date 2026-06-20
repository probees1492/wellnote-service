/**
 * KST (UTC+9) time utilities.
 * All business-day boundaries in WellNote are KST-fixed (SPEC §4.5, §7.1).
 */

export const KST_OFFSET_MIN = 9 * 60; // 540
export const KST_OFFSET_MS = KST_OFFSET_MIN * 60 * 1000;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function asDate(input: Date | number | string): Date {
  if (input instanceof Date) return input;
  if (typeof input === "number") return new Date(input);
  return new Date(input);
}

/**
 * Convert any Date/timestamp into the KST calendar date string ('YYYY-MM-DD').
 */
export function toDateKst(input: Date | number | string): string {
  const d = asDate(input);
  const shifted = new Date(d.getTime() + KST_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = pad2(shifted.getUTCMonth() + 1);
  const day = pad2(shifted.getUTCDate());
  return `${y}-${m}-${day}`;
}

/**
 * Returns the KST date string for "now".
 */
export function todayKst(now: Date = new Date()): string {
  return toDateKst(now);
}

function parseKstDate(dateKst: string): { y: number; m: number; d: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKst);
  if (!m) throw new Error(`invalid date_kst: ${dateKst}`);
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

function formatKstDate(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/**
 * Given a KST date string ('YYYY-MM-DD'), return the previous KST date string.
 */
export function previousDateKst(dateKst: string): string {
  const { y, m, d } = parseKstDate(dateKst);
  // Treat as UTC date for arithmetic safety.
  const t = Date.UTC(y, m - 1, d);
  const prev = new Date(t - 24 * 60 * 60 * 1000);
  return formatKstDate(
    prev.getUTCFullYear(),
    prev.getUTCMonth() + 1,
    prev.getUTCDate(),
  );
}

/**
 * Given a KST date string ('YYYY-MM-DD'), return the next KST date string.
 */
export function nextDateKst(dateKst: string): string {
  const { y, m, d } = parseKstDate(dateKst);
  const t = Date.UTC(y, m - 1, d);
  const next = new Date(t + 24 * 60 * 60 * 1000);
  return formatKstDate(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
  );
}

/**
 * Compute the inclusive start of a KST calendar date in UTC ISO.
 *   '2026-06-20' -> '2026-06-19T15:00:00.000Z'
 */
export function startOfKstDayUtc(dateKst: string): string {
  const { y, m, d } = parseKstDate(dateKst);
  const utcMs = Date.UTC(y, m - 1, d) - KST_OFFSET_MS;
  return new Date(utcMs).toISOString();
}

/**
 * Inclusive list of KST dates in [from, to].
 */
export function enumerateKstDates(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  // Guard against infinite loop on inverted ranges.
  const fromTs = Date.parse(`${from}T00:00:00Z`);
  const toTs = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(fromTs) || Number.isNaN(toTs) || fromTs > toTs) {
    return [];
  }
  while (true) {
    out.push(cur);
    if (cur === to) break;
    cur = nextDateKst(cur);
    if (out.length > 10000) break; // safety
  }
  return out;
}
