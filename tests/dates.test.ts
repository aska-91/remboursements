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
