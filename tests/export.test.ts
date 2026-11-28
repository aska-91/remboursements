import { describe, expect, it } from "vitest";
import { buildCsv } from "../src/export/csv";
import { buildBackup, parseBackup } from "../src/export/json";
import { importBackup } from "../src/domain/data";
import type { Doc } from "../src/domain/types";
import { claim, item, NOW, TODAY } from "./fixtures";

const rows = (csv: string) => csv.replace(/^﻿/, "").trimEnd().split("\r\n");

describe("CSV export", () => {
  it("one row per refund line, with header, BOM, ; separator and comma decimals", () => {
    const c = claim({
      date: "2026-06-01", label: "Dr Martin", amount: 3000, ref: "FS-1",
      items: [item({ source: "social_security", expected: 2000, received: 2000, receivedDate: "2026-06-05" }), item({ source: "mutuelle", expected: 950, received: 500 })],
      log: [{ t: NOW, text: "Expense created" }],
    });
    const csv = buildCsv([c], TODAY);
    expect(csv.startsWith("﻿")).toBe(true);
    const r = rows(csv);
    expect(r).toHaveLength(3);
    expect(r[0]!.split(";")).toHaveLength(25);
    const line2 = r[2]!.split(";");
    expect(line2.slice(0, 10)).toEqual(["01/06/2026", "Dr Martin", "General practitioner", "Health", "", "", "FS-1", "30,00", "Gap to chase", "no"]);
    expect(line2.slice(10, 17)).toEqual(["Mutuelle", "9,50", "30/06/2026", "5,00", "4,50", "", "Gap"]);
    expect(line2.at(-1)).toBe("15/06/2026 12:00 Expense created");
  });
  it("keeps an expense without lines", () => {
    expect(rows(buildCsv([claim({ items: [] })], TODAY))).toHaveLength(2);
  });
  it("quotes separators, quotes and new lines", () => {
    const r = rows(buildCsv([claim({ label: 'Shop; "A"', notes: "a\nb", items: [] })], TODAY));
    expect(r[1]).toContain('"Shop; ""A"""');
    expect(r[1]).toContain('"a\nb"');
  });
  it("neutralises text that a spreadsheet would run as a formula", () => {
    const r = rows(buildCsv([claim({ label: "=HYPERLINK(\"x\")", items: [] })], TODAY));
    expect(r[1]!.split(";")[1]).toBe(`"'=HYPERLINK(""x"")"`);
  });
});

describe("JSON backup", () => {
  it("round-trips everything, deletions included", () => {
    const doc: Doc = { version: 3, claims: [claim({ id: "a" })], deleted: { gone: 5 } };
    expect(parseBackup(buildBackup(doc, NOW), TODAY)).toEqual(doc);
  });
  it("accepts a backup exported by the prototype", () => {
    const proto = JSON.stringify({ v: 2, claims: [{ id: "p", label: "Pharmacie", cat: "Pharmacie", amount: 12.5, items: [] }], deleted: {} }, null, 1);
    expect(parseBackup(proto, TODAY).claims[0]).toMatchObject({ category: "pharmacy", amount: 1250 });
  });
  it("rejects files that are not backups", () => {
    expect(() => parseBackup("not json", TODAY)).toThrow();
    expect(() => parseBackup('{"a":1}', TODAY)).toThrow();
  });
});

describe("import by merge", () => {
  const here: Doc = { version: 3, claims: [claim({ id: "a", mod: 10 }), claim({ id: "b", mod: 10 }), claim({ id: "c", mod: 10 })], deleted: {} };
  it("adds new, updates older, removes deleted, keeps newer local edits", () => {
    const file: Doc = {
      version: 3,
      claims: [claim({ id: "a", mod: 20, label: "newer" }), claim({ id: "b", mod: 5, label: "older" }), claim({ id: "n", mod: 1 })],
      deleted: { c: 15 },
    };
    const r = importBackup(here, file);
    expect([r.added, r.updated, r.removed]).toEqual([1, 1, 1]);
    expect(r.doc.claims.find((c) => c.id === "a")!.label).toBe("newer");
    expect(r.doc.claims.find((c) => c.id === "b")!.label).toBe("Visit");
  });
  it("importing the same data twice changes nothing", () => {
    const r = importBackup(here, structuredClone(here));
    expect([r.added, r.updated, r.removed]).toEqual([0, 0, 0]);
  });
});
