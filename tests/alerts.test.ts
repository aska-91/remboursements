import { describe, expect, it } from "vitest";
import { buildAlerts } from "../src/domain/alerts";
import { claim, item, shop, TODAY } from "./fixtures";

describe("to-do alerts", () => {
  it("return deadline: alert from 7 days before, overdue after", () => {
    expect(buildAlerts([shop({ returnBy: "2026-06-23" })], TODAY)).toEqual([]);
    expect(buildAlerts([shop({ id: "s", returnBy: "2026-06-22" })], TODAY)).toEqual([{ kind: "return_soon", claimId: "s", days: 7, severity: 1 }]);
    expect(buildAlerts([shop({ id: "s", returnBy: "2026-06-13" })], TODAY)).toEqual([{ kind: "return_overdue", claimId: "s", days: -2, severity: 0 }]);
    expect(buildAlerts([shop({ returnBy: "2026-06-13", returnedDate: "2026-06-10" })], TODAY)).toEqual([]);
  });
  it("request deadline: alert from 30 days before", () => {
    const c = (claimBy: string) => claim({ id: "h", needsRequest: true, claimBy });
    expect(buildAlerts([c("2026-07-16")], TODAY)).toEqual([]);
    expect(buildAlerts([c("2026-07-15")], TODAY)[0]).toMatchObject({ kind: "request_soon", days: 30, deadline: "2026-07-15" });
    expect(buildAlerts([c("2026-06-14")], TODAY)[0]).toMatchObject({ kind: "request_overdue", days: -1 });
    expect(buildAlerts([{ ...c("2026-06-14"), sentDate: "2026-06-01" }], TODAY)).toEqual([]);
  });
  it("late lines and gaps", () => {
    const c = claim({ id: "x", items: [item({ id: "a", due: "2026-06-10", expected: 500 }), item({ id: "b", received: 200, expected: 500, source: "mutuelle" })] });
    expect(buildAlerts([c], TODAY)).toEqual([
      { kind: "item_late", claimId: "x", itemId: "a", source: "social_security", amount: 500, days: -5, severity: 0 },
      { kind: "item_gap", claimId: "x", itemId: "b", source: "mutuelle", amount: 300, severity: 1 },
    ]);
  });
  it("ignores archived and cancelled claims", () => {
    const late = [item({ due: "2026-06-01" })];
    expect(buildAlerts([claim({ archived: true, items: late }), claim({ cancelled: true, items: late })], TODAY)).toEqual([]);
  });
  it("sorted: overdue first (most overdue first), then soonest", () => {
    const a = buildAlerts([
      shop({ id: "soon", returnBy: "2026-06-20" }),
      claim({ id: "late2", items: [item({ due: "2026-06-13" })] }),
      claim({ id: "late9", items: [item({ due: "2026-06-06" })] }),
      shop({ id: "sooner", returnBy: "2026-06-16" }),
    ], TODAY);
    expect(a.map((x) => x.claimId)).toEqual(["late9", "late2", "sooner", "soon"]);
  });
});
