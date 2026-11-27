import { describe, expect, it } from "vitest";
import { mergeDocs, readDoc } from "../src/domain/data";
import type { Doc } from "../src/domain/types";
import { claim } from "./fixtures";

const prototypeBackup = {
  v: 2,
  claims: [{
    id: "abc", date: "2026-03-02", label: "Lunettes", cat: "Dentiste / Optique", amount: 349.9, ref: "R1", notes: "",
    archived: false, outcome: "annule", needsRequest: true, claimBy: "2028-03-02", sentDate: "",
    refundMode: "Avoir / bon d'achat", log: [{ t: 5, text: "Dépense créée" }], mod: 5,
    items: [
      { id: "i1", source: "Sécurité sociale", expected: 0.1 + 0.2, due: "2026-03-09", received: null },
      { id: "i2", source: "Mutuelle", expected: "120.5", received: 100.25, receivedDate: "2026-03-20", writeOff: true },
      { id: "i3", source: "Inconnue", expected: 1 },
    ],
  }],
  deleted: { old: 3 },
};

describe("reading data", () => {
  it("converts a prototype backup (French values, euros) to the current format", () => {
    const d = readDoc(prototypeBackup, "2026-01-01");
    const c = d.claims[0]!;
    expect(c).toMatchObject({ category: "dental_optical", amount: 34990, cancelled: true, refundMode: "store_credit", needsRequest: true });
    expect(c.items.map((i) => [i.source, i.expected, i.received, i.writeOff])).toEqual([
      ["social_security", 30, null, false], ["mutuelle", 12050, 10025, true], ["other", 100, null, false],
    ]);
    expect(c.log).toEqual([{ t: 5, text: "Dépense créée" }]);
    expect(d.deleted).toEqual({ old: 3 });
  });
  it("keeps the current format unchanged", () => {
    const doc: Doc = { version: 3, claims: [claim({ id: "x" })], deleted: {} };
    expect(readDoc(JSON.parse(JSON.stringify(doc)), "2026-01-01")).toEqual(doc);
  });
  it("repairs bad values and rejects files that are not backups", () => {
    const d = readDoc({ version: 3, claims: [{ date: "31/12/2026", category: "nope", amount: "abc" }] }, "2026-01-01");
    expect(d.claims[0]).toMatchObject({ date: "2026-01-01", category: "other", amount: 0, items: [], log: [] });
    expect(d.claims[0]!.id).toBeTruthy();
    expect(() => readDoc({ hello: 1 }, "2026-01-01")).toThrow();
    expect(() => readDoc(null, "2026-01-01")).toThrow();
  });
});

describe("merging", () => {
  const doc = (claims: Doc["claims"], deleted: Doc["deleted"] = {}): Doc => ({ version: 3, claims, deleted });

  it("keeps claims from both sides", () => {
    const m = mergeDocs(doc([claim({ id: "a" })]), doc([claim({ id: "b" })]));
    expect(m.claims.map((c) => c.id).sort()).toEqual(["a", "b"]);
  });
  it("the most recently modified version wins, whichever side it is on", () => {
    const old = claim({ id: "a", label: "old", mod: 10 });
    const neu = claim({ id: "a", label: "new", mod: 20 });
    expect(mergeDocs(doc([old]), doc([neu])).claims[0]!.label).toBe("new");
    expect(mergeDocs(doc([neu]), doc([old])).claims[0]!.label).toBe("new");
    expect(mergeDocs(doc([claim({ id: "a", label: "mine", mod: 10 })]), doc([old])).claims[0]!.label).toBe("mine");
  });
  it("a deletion removes older versions but not a newer edit", () => {
    expect(mergeDocs(doc([claim({ id: "a", mod: 10 })]), doc([], { a: 15 })).claims).toEqual([]);
    expect(mergeDocs(doc([claim({ id: "a", mod: 20 })]), doc([], { a: 15 })).claims).toHaveLength(1);
  });
  it("deletion records are kept (latest time) so they keep applying", () => {
    expect(mergeDocs(doc([], { a: 5, b: 9 }), doc([], { a: 7 })).deleted).toEqual({ a: 7, b: 9 });
  });
});
