import type { Ymd } from "./types";

/** Dates are handled as "YYYY-MM-DD" strings, computed in the Europe/Paris time zone. */
export const TIME_ZONE = "Europe/Paris";

const ymdFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
});
const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

/** Calendar date in Europe/Paris for a given instant. */
export function toYmd(instant: Date | number): Ymd {
  return ymdFormat.format(instant);
}

/** Today's date in Europe/Paris; `now` is injectable for tests. */
export function today(now: Date | number = Date.now()): Ymd {
  return toYmd(now);
}

function parts(s: Ymd): [number, number, number] {
  const [y, m, d] = s.split("-").map(Number);
  return [y!, m!, d!];
}
function fromUtc(ms: number): Ymd {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Pure calendar arithmetic (no time zone involved). */
export function addDays(s: Ymd, n: number): Ymd {
  const [y, m, d] = parts(s);
  return fromUtc(Date.UTC(y, m - 1, d + n));
}

/** Same rule as JavaScript's setFullYear: 29 Feb + 1 year → 1 Mar. */
export function addYears(s: Ymd, n: number): Ymd {
  const [y, m, d] = parts(s);
  return fromUtc(Date.UTC(y + n, m - 1, d));
}

/** Number of days from a to b (positive when b is later). */
export function daysBetween(a: Ymd, b: Ymd): number {
  const [ya, ma, da] = parts(a);
  const [yb, mb, db] = parts(b);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000);
}

/** "YYYY-MM-DD" → "DD/MM/YYYY". */
export function formatDate(s: Ymd): string {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

/** Timestamp → "DD/MM/YYYY HH:MM" in Europe/Paris. */
export function formatDateTime(t: number): string {
  return `${formatDate(toYmd(t))} ${timeFormat.format(t)}`;
}

export function isValidYmd(s: unknown): s is Ymd {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = parts(s);
  return fromUtc(Date.UTC(y, m - 1, d)) === s;
}

/** First day of the month of `s`. */
export function startOfMonth(s: Ymd): Ymd {
  return `${s.slice(0, 7)}-01`;
}

/** Last day of the month of `s` (handles leap years). */
export function endOfMonth(s: Ymd): Ymd {
  const [y, m] = parts(s);
  return fromUtc(Date.UTC(y, m, 0));
}

/** Month of `s` shifted by `n` months, as the first day of that month. */
export function addMonths(s: Ymd, n: number): Ymd {
  const [y, m] = parts(s);
  return fromUtc(Date.UTC(y, m - 1 + n, 1));
}
