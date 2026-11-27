import { describe, expect, it } from "vitest";
import { today, toYmd } from "../src/domain/dates";

describe("dates in Europe/Paris", () => {
  it("uses the Paris calendar day, not UTC", () => {
    // 23:30 UTC on 31 Dec is already 1 Jan in Paris (UTC+1 in winter).
    expect(toYmd(Date.UTC(2025, 11, 31, 23, 30))).toBe("2026-01-01");
  });
  it("handles summer time (UTC+2)", () => {
    expect(toYmd(Date.UTC(2026, 5, 30, 22, 30))).toBe("2026-07-01");
  });
  it("today() accepts an injected clock", () => {
    expect(today(Date.UTC(2026, 10, 27, 12))).toBe("2026-11-27");
  });
});

import { addDays, addYears, daysBetween, formatDate, formatDateTime, isValidYmd } from "../src/domain/dates";
import { formatMoney, toCents } from "../src/domain/money";

describe("calendar arithmetic", () => {
  it("addDays across months, years and DST changes", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-25", 14)).toBe("2027-01-08");
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30"); // DST starts 29 March
    expect(addDays("2026-06-15", -15)).toBe("2026-05-31");
  });
  it("addYears follows the prototype on 29 February", () => {
    expect(addYears("2028-02-29", 2)).toBe("2030-03-01");
  });
  it("daysBetween", () => {
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
    expect(daysBetween("2026-06-15", "2026-06-10")).toBe(-5);
  });
  it("formats", () => {
    expect(formatDate("2026-06-05")).toBe("05/06/2026");
    expect(formatDate("")).toBe("");
    expect(formatDateTime(Date.UTC(2026, 5, 5, 22, 7))).toBe("06/06/2026 00:07");
  });
  it("isValidYmd", () => {
    expect(isValidYmd("2026-02-28")).toBe(true);
    expect(isValidYmd("2026-02-30")).toBe(false);
    expect(isValidYmd("05/06/2026")).toBe(false);
  });
});

describe("money", () => {
  it("converts euros to cents without float errors", () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents("12,50")).toBe(1250);
    expect(toCents("abc")).toBe(0);
  });
  it("formats as €12.50", () => {
    expect(formatMoney(1250)).toBe("€12.50");
    expect(formatMoney(123456)).toBe("€1,234.56");
    expect(formatMoney(-500)).toBe("-€5.00");
  });
});
