/** Dates are handled as "YYYY-MM-DD" strings, computed in the Europe/Paris time zone. */
export const TIME_ZONE = "Europe/Paris";

const ymdFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
});

/** Calendar date in Europe/Paris for a given instant. */
export function toYmd(instant: Date | number): string {
  return ymdFormat.format(instant);
}

/** Today's date in Europe/Paris; `now` is injectable for tests. */
export function today(now: Date | number = Date.now()): string {
  return toYmd(now);
}
