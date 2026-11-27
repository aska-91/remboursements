import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { indexedDbStorage, openDatabase } from "../src/storage/indexedDb";
import { memoryStorage } from "../src/storage/memory";
import { migratePrototype, PROTOTYPE_KEYS } from "../src/storage/startup";
import type { Storage } from "../src/storage/Storage";
import type { Doc } from "../src/domain/types";
import { claim } from "./fixtures";

let n = 0;
const doc = (claims: Doc["claims"], deleted: Doc["deleted"] = {}): Doc => ({ version: 3, claims, deleted });
const freshDb = () => openDatabase(`test-${++n}`);

function contract(name: string, make: () => Promise<Storage>) {
  describe(`${name} storage`, () => {
    it("starts empty", async () => {
      expect(await (await make()).load()).toEqual(doc([]));
    });
    it("saves and loads back", async () => {
      const s = await make();
      const d = doc([claim({ id: "a" }), claim({ id: "b" })], { z: 3 });
      await s.save(d);
      const back = await s.load();
      expect(back.claims.map((c) => c.id).sort()).toEqual(["a", "b"]);
      expect(back.deleted).toEqual({ z: 3 });
      expect(back.claims.find((c) => c.id === "a")).toEqual(d.claims[0]);
    });
    it("two windows saving different expenses do not erase each other", async () => {
      const s = await make();
      await s.save(doc([claim({ id: "a", mod: 1 })]));
      const windowA = await s.load();
      const windowB = await s.load();
      await s.save({ ...windowA, claims: [...windowA.claims, claim({ id: "fromA", mod: 2 })] });
      const merged = await s.save({ ...windowB, claims: [...windowB.claims, claim({ id: "fromB", mod: 3 })] });
      expect(merged.claims.map((c) => c.id).sort()).toEqual(["a", "fromA", "fromB"]);
    });
    it("the newest edit of an expense wins", async () => {
      const s = await make();
      await s.save(doc([claim({ id: "a", label: "new", mod: 20 })]));
      await s.save(doc([claim({ id: "a", label: "stale", mod: 10 })]));
      expect((await s.load()).claims[0]!.label).toBe("new");
    });
    it("a permanent deletion is applied and remembered", async () => {
      const s = await make();
      await s.save(doc([claim({ id: "a", mod: 5 }), claim({ id: "b", mod: 5 })]));
      await s.save(doc([claim({ id: "b", mod: 5 })], { a: 10 }));
      // An old copy coming back (e.g. a stale window) must not resurrect it.
      await s.save(doc([claim({ id: "a", mod: 5 })]));
      const back = await s.load();
      expect(back.claims.map((c) => c.id)).toEqual(["b"]);
      expect(back.deleted).toEqual({ a: 10 });
    });
  });
}

contract("memory", async () => memoryStorage());
contract("IndexedDB", async () => indexedDbStorage(await freshDb()));

describe("IndexedDB specifics", () => {
  it("data survives reopening the database", async () => {
    const name = `test-${++n}`;
    const db1 = await openDatabase(name);
    await indexedDbStorage(db1).save(doc([claim({ id: "a" })]));
    db1.close();
    const db2 = await openDatabase(name);
    expect((await indexedDbStorage(db2).load()).claims.map((c) => c.id)).toEqual(["a"]);
  });
  it("notifies other windows after a save", async () => {
    const db = await freshDb();
    const writer = indexedDbStorage(db, `chan-${n}`);
    const reader = indexedDbStorage(db, `chan-${n}`);
    const got = new Promise<void>((resolve) => reader.onExternalChange(resolve));
    await writer.save(doc([claim()]));
    await expect(got).resolves.toBeUndefined();
  });
});

describe("taking over the prototype's data", () => {
  const legacy = JSON.stringify({ v: 2, claims: [{ id: "p1", label: "Pharmacie", cat: "Pharmacie", amount: 12.5, items: [] }], deleted: {} });
  const local = (v: string | null, key = PROTOTYPE_KEYS[0]!) => ({ getItem: (k: string) => (k === key ? v : null) });

  it("imports once, converting the prototype format", async () => {
    const db = await freshDb();
    const s = indexedDbStorage(db);
    expect(await migratePrototype(db, s, local(legacy))).toBe(1);
    expect((await s.load()).claims[0]).toMatchObject({ id: "p1", category: "pharmacy", amount: 1250 });
    // Second start: not imported again, even if the user later deleted everything.
    expect(await migratePrototype(db, s, local(legacy))).toBe(0);
  });
  it("reads the older v1 key too", async () => {
    const db = await freshDb();
    expect(await migratePrototype(db, indexedDbStorage(db), local(legacy, "remboursements-v1"))).toBe(1);
  });
  it("ignores missing or broken data", async () => {
    const db1 = await freshDb();
    expect(await migratePrototype(db1, indexedDbStorage(db1), local(null))).toBe(0);
    const db2 = await freshDb();
    expect(await migratePrototype(db2, indexedDbStorage(db2), local("{not json"))).toBe(0);
    const db3 = await freshDb();
    expect(await migratePrototype(db3, indexedDbStorage(db3), undefined)).toBe(0);
  });
});
