import { describe, expect, it } from "vitest";
import * as A from "../src/domain/actions";
import { buildReport, periodRange, reportClaims, storeChoices, subcategoryChoices, normKey, ALL_FILTER, type ReportFilter } from "../src/domain/report";
import { groupOf } from "../src/domain/types";
import { claim, item, NOW, shop, TODAY } from "./fixtures";

const f = (p: Partial<ReportFilter>): ReportFilter => ({ ...ALL_FILTER, ...p });
const done = (cents: number) => [item({ expected: cents, received: cents })];

const claims = [
  claim({ id: "gp1", date: "2026-03-10", category: "gp", amount: 3000, items: [item({ expected: 2000, received: 2000 }), item({ expected: 900 })] }),
  claim({ id: "sp1", date: "2026-03-25", category: "specialist", amount: 6000, items: [item({ expected: 2500, received: 2500 })] }),
  claim({ id: "sp2", date: "2026-05-02", category: "specialist", amount: 5000, items: [item({ expected: 2000, received: 1000, writeOff: true })] }),
  claim({ id: "lab", date: "2026-05-20", category: "lab_tests", amount: 4000, items: done(3000) }),
  shop({ id: "dec1", date: "2026-02-01", store: "Decathlon", subcategory: "Sport", amount: 8000, returnedDate: "2026-02-05", items: [item({ source: "retailer", expected: 8000, received: 8000 })] }),
  shop({ id: "dec2", date: "2026-04-15", store: "décathlon ", subcategory: "sport", amount: 2500, returnedDate: "2026-04-18", items: [item({ source: "retailer", expected: 2500, received: 2500 })] }),
  shop({ id: "zara", date: "2026-04-20", store: "Zara", subcategory: "Clothes", amount: 4500, items: [item({ source: "retailer", expected: 4500 })] }),
  shop({ id: "old", date: "2025-12-01", store: "", amount: 1000, items: [item({ source: "retailer", expected: 1000 })] }),
  claim({ id: "oth", date: "2026-06-01", category: "other", subcategory: "Pets", amount: 2000, items: done(500) }),
  claim({ id: "gone", date: "2026-03-12", category: "gp", amount: 9999, cancelled: true }),
];
const ids = (cs: { id: string }[]) => cs.map((c) => c.id).sort();

describe("families", () => {
  it("health categories, shopping, other", () => {
    expect(["gp", "specialist", "pharmacy", "dental_optical", "lab_tests"].map((c) => groupOf(c as never))).toEqual(Array(5).fill("health"));
    expect(groupOf("item_return")).toBe("shopping");
    expect(groupOf("other")).toBe("other");
  });
});

describe("filters", () => {
  it("cancelled expenses are never part of a report", () => {
    expect(reportClaims(claims, ALL_FILTER).map((c) => c.id)).not.toContain("gone");
  });
  it("by family", () => {
    expect(ids(reportClaims(claims, f({ group: "health" })))).toEqual(["gp1", "lab", "sp1", "sp2"]);
    expect(ids(reportClaims(claims, f({ group: "shopping" })))).toEqual(["dec1", "dec2", "old", "zara"]);
    expect(ids(reportClaims(claims, f({ group: "other" })))).toEqual(["oth"]);
  });
  it("by health type", () => {
    expect(ids(reportClaims(claims, f({ group: "health", category: "specialist" })))).toEqual(["sp1", "sp2"]);
    expect(ids(reportClaims(claims, f({ group: "health", category: "lab_tests" })))).toEqual(["lab"]);
  });
  it("by store, ignoring case, accents and spaces; expenses without a store have their own key", () => {
    expect(normKey(" DÉCATHLON ")).toBe("decathlon");
    expect(ids(reportClaims(claims, f({ group: "shopping", store: "decathlon" })))).toEqual(["dec1", "dec2"]);
    expect(ids(reportClaims(claims, f({ group: "shopping", store: "" })))).toEqual(["old"]);
  });
  it("by sub-category", () => {
    expect(ids(reportClaims(claims, f({ group: "shopping", subcategory: "sport" })))).toEqual(["dec1", "dec2"]);
    expect(ids(reportClaims(claims, f({ group: "other", subcategory: "pets" })))).toEqual(["oth"]);
  });
  it("store and sub-category filters only apply to their own family", () => {
    expect(ids(reportClaims(claims, f({ group: "health", store: "zara", subcategory: "clothes" })))).toHaveLength(4);
  });
  it("period bounds are inclusive and use the expense date", () => {
    expect(ids(reportClaims(claims, f({ from: "2026-03-10", to: "2026-03-25" })))).toEqual(["gp1", "sp1"]);
    expect(ids(reportClaims(claims, f({ from: "2026-06-01" })))).toEqual(["oth"]);
    expect(ids(reportClaims(claims, f({ to: "2025-12-31" })))).toEqual(["old"]);
  });
});

describe("totals", () => {
  it("advanced, received, to receive and real cost for a store over a period", () => {
    const r = buildReport(claims, f({ group: "shopping", store: "decathlon", from: "2026-01-01", to: "2026-12-31" }), TODAY);
    expect(r.totals).toEqual({ count: 2, advanced: 10500, received: 10500, remaining: 0, outOfPocket: 0 });
    const z = buildReport(claims, f({ group: "shopping", store: "zara" }), TODAY);
    expect(z.totals).toEqual({ count: 1, advanced: 4500, received: 0, remaining: 4500, outOfPocket: 0 });
  });
  it("health: a gap accepted as out-of-pocket is part of the real cost", () => {
    const r = buildReport(claims, f({ group: "health", category: "specialist" }), TODAY);
    expect(r.totals).toEqual({ count: 2, advanced: 11000, received: 3500, remaining: 0, outOfPocket: 7500 });
  });
});

describe("breakdown and timeline", () => {
  it("shopping is split by store (spellings merged), biggest first", () => {
    const r = buildReport(claims, f({ group: "shopping" }), TODAY);
    expect(r.dimension).toBe("store");
    expect(r.breakdown.map((b) => [b.key, b.count, b.advanced])).toEqual([["decathlon", 2, 10500], ["zara", 1, 4500], ["", 1, 1000]]);
  });
  it("health is split by type, all families by family, other by sub-category", () => {
    expect(buildReport(claims, f({ group: "health" }), TODAY).breakdown.map((b) => b.key)).toEqual(["specialist", "lab_tests", "gp"]);
    expect(buildReport(claims, ALL_FILTER, TODAY).breakdown.map((b) => b.key).sort()).toEqual(["health", "other", "shopping"]);
    expect(buildReport(claims, f({ group: "other" }), TODAY).breakdown.map((b) => b.key)).toEqual(["pets"]);
  });
  it("timeline is grouped by month, newest first by default, with monthly totals", () => {
    const r = buildReport(claims, f({ group: "health" }), TODAY);
    expect(r.months.map((m) => [m.month, m.count, m.advanced])).toEqual([["2026-05", 2, 9000], ["2026-03", 2, 9000]]);
    expect(r.months[0]!.claims.map((c) => c.id)).toEqual(["lab", "sp2"]);
    const asc = buildReport(claims, f({ group: "health" }), TODAY, false);
    expect(asc.months.map((m) => m.month)).toEqual(["2026-03", "2026-05"]);
  });
  it("the month totals add up to the report total", () => {
    const r = buildReport(claims, ALL_FILTER, TODAY);
    expect(r.months.reduce((s, m) => s + m.advanced, 0)).toBe(r.totals.advanced);
    expect(r.breakdown.reduce((s, b) => s + b.outOfPocket, 0)).toBe(r.totals.outOfPocket);
  });
  it("empty result", () => {
    const r = buildReport(claims, f({ from: "2030-01-01" }), TODAY);
    expect(r.months).toEqual([]);
    expect(r.totals.count).toBe(0);
  });
});

describe("choices for suggestions and filters", () => {
  it("stores: one entry per store, most recent spelling, 'no store' last", () => {
    const cs = [
      shop({ store: "Decathlon", mod: 1 }), shop({ store: "décathlon", mod: 5 }), shop({ store: "Zara", mod: 2 }), shop({ store: "", mod: 9 }),
      shop({ store: "Gone", cancelled: true }), claim({ store: "Ignored" }),
    ];
    expect(storeChoices(cs)).toEqual([{ key: "decathlon", label: "décathlon", count: 2 }, { key: "zara", label: "Zara", count: 1 }, { key: "", label: "", count: 1 }]);
  });
  it("sub-categories of the given families", () => {
    const cs = [shop({ subcategory: "Sport" }), shop({ subcategory: "sport " }), claim({ category: "other", subcategory: "Pets" }), claim({ subcategory: "" })];
    expect(subcategoryChoices(cs, ["shopping"]).map((c) => c.key)).toEqual(["sport"]);
    expect(subcategoryChoices(cs, ["shopping", "other"]).map((c) => c.key)).toEqual(["pets", "sport"]);
  });
});

describe("period presets", () => {
  it("this and last month, this and last year, all", () => {
    expect(periodRange("this_month", "2026-11-28")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(periodRange("last_month", "2026-01-15")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(periodRange("last_month", "2026-03-31")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(periodRange("last_month", "2024-03-10")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(periodRange("this_year", "2026-11-28")).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(periodRange("last_year", "2026-11-28")).toEqual({ from: "2025-01-01", to: "2025-12-31" });
    expect(periodRange("all", "2026-11-28")).toEqual({ from: "", to: "" });
  });
});

describe("store and sub-category when saving an expense", () => {
  const input = (p: Partial<A.ClaimInput>): A.ClaimInput => ({
    date: TODAY, label: "Item", category: "item_return", store: "Zara", subcategory: "Clothes", amount: 3000, ref: "", notes: "", returnBy: "", returnedDate: "",
    tracking: "", refundMode: "original_payment", needsRequest: false, claimBy: "", sentDate: "", items: A.defaultItems("item_return", TODAY, 3000), ...p,
  });
  it("shopping needs a store", () => {
    expect(() => A.createClaim(input({ store: "  " }), NOW)).toThrow("Store");
    const c = A.createClaim(input({ store: "  Zara " }), NOW);
    expect([c.store, c.subcategory]).toEqual(["Zara", "Clothes"]);
  });
  it("health keeps neither store nor sub-category; other keeps only the sub-category", () => {
    const h = A.createClaim(input({ category: "gp", store: "Zara", subcategory: "x", items: A.defaultItems("gp", TODAY, 3000) }), NOW);
    expect([h.store, h.subcategory]).toEqual(["", ""]);
    const o = A.createClaim(input({ category: "other", store: "Zara", subcategory: " Pets ", items: A.defaultItems("other", TODAY, 3000) }), NOW);
    expect([o.store, o.subcategory]).toEqual(["", "Pets"]);
  });
  it("an old shopping expense without a store must get one when edited", () => {
    const old = shop({ store: "" });
    expect(() => A.editClaim(old, input({ store: "" }), NOW)).toThrow("Store");
    expect(A.editClaim(old, input({ store: "Zara" }), NOW).store).toBe("Zara");
  });
});
