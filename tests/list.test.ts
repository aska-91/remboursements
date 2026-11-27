import { describe, expect, it } from "vitest";
import { listClaims, matchesFilter, matchesSearch } from "../src/domain/list";
import { claim, item, shop, TODAY } from "./fixtures";

const done = claim({ id: "done", date: "2026-05-01", items: [item({ received: 1000 })] });
const doneNewer = claim({ id: "doneNewer", date: "2026-05-20", items: [item({ received: 1000 })] });
const late = claim({ id: "late", items: [item({ due: "2026-06-01" })] });
const pendingSoon = claim({ id: "soon", items: [item({ due: "2026-06-20" })] });
const pendingLater = claim({ id: "later", items: [item({ due: "2026-07-20" })] });
const toReturn = shop({ id: "ret" });
const refused = claim({ id: "ref", items: [item({ refused: true })] });
const archived = claim({ id: "arch", archived: true, items: [item({ received: 1000 })] });

describe("filters", () => {
  const all = [done, late, pendingSoon, toReturn, refused, archived];
  const ids = (f: Parameters<typeof matchesFilter>[1]) => all.filter((c) => matchesFilter(c, f, TODAY)).map((c) => c.id);
  it("each view", () => {
    expect(ids("in_progress")).toEqual(["late", "soon", "ret"]);
    expect(ids("to_chase")).toEqual(["late"]);
    expect(ids("done")).toEqual(["done"]);
    expect(ids("refused_cancelled")).toEqual(["ref"]);
    expect(ids("archived")).toEqual(["arch"]);
    expect(ids("all")).toHaveLength(6);
  });
});

describe("search", () => {
  it("looks in label, notes, reference, tracking and journal, case-insensitive", () => {
    const c = claim({ label: "Dr Martin", notes: "knee", ref: "FS-12", tracking: "XY99", log: [{ t: 1, text: "Chased by phone" }] });
    for (const q of ["martin", "KNEE", "fs-12", "xy99", "phone", ""]) expect(matchesSearch(c, q)).toBe(true);
    expect(matchesSearch(c, "dentist")).toBe(false);
    expect(matchesSearch(c, "pharmacy", "Pharmacy")).toBe(true);
  });
});

describe("sorting", () => {
  it("urgent first, open ones by next due date, closed ones newest first", () => {
    const r = listClaims([doneNewer, pendingLater, done, toReturn, pendingSoon, late], { filter: "all", search: "", category: "all" }, TODAY);
    expect(r.map((c) => c.id)).toEqual(["late", "ret", "soon", "later", "doneNewer", "done"]);
  });
  it("category filter", () => {
    const r = listClaims([done, toReturn], { filter: "all", search: "", category: "item_return" }, TODAY);
    expect(r.map((c) => c.id)).toEqual(["ret"]);
  });
});
