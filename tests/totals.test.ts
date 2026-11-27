import { describe, expect, it } from "vitest";
import { remainingBySource, summary, yearlyTotals } from "../src/domain/totals";
import { claim, item, TODAY } from "./fixtures";

const claims = [
  claim({ amount: 5000, items: [item({ source: "social_security", expected: 3000, received: 3000 }), item({ source: "mutuelle", expected: 1500 })] }),
  claim({ amount: 2000, items: [item({ source: "mutuelle", expected: 2000, received: 1200 })] }),
  claim({ amount: 1000, items: [item({ expected: 700, due: "2026-01-02" })], archived: true, date: "2025-03-01" }),
  claim({ amount: 9999, cancelled: true, items: [item({ expected: 9999 })] }),
];

describe("summary", () => {
  it("adds up everything except cancelled claims", () => {
    expect(summary(claims, TODAY)).toEqual({
      advanced: 8000, received: 4200,
      remaining: 1500 + 800 + 700, remainingCount: 3,
      atRisk: 800 + 700,
      outOfPocket: 8000 - 4200 - 3000,
    });
  });
  it("by source", () => {
    expect(remainingBySource(claims, TODAY)).toEqual({ social_security: 700, mutuelle: 2300, retailer: 0, other: 0 });
  });
  it("by year, newest first", () => {
    expect(yearlyTotals(claims, TODAY)).toEqual([
      { year: "2026", count: 2, advanced: 7000, received: 4200, remaining: 2300, outOfPocket: 500 },
      { year: "2025", count: 1, advanced: 1000, received: 0, remaining: 700, outOfPocket: 300 },
    ]);
  });
});
