import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Claim, Doc } from "../domain/types";
import { mergeDocs } from "../domain/data";
import type { Storage } from "./Storage";

const DB_VERSION = 1;

interface Schema extends DBSchema {
  /** One record per expense, keyed by id. */
  claims: { key: string; value: Claim };
  /** Small key/value records: deletions, migration flags. */
  meta: { key: string; value: unknown };
}

export type Db = IDBPDatabase<Schema>;

export function openDatabase(name = "refund-tracker"): Promise<Db> {
  return openDB<Schema>(name, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore("claims", { keyPath: "id" });
      db.createObjectStore("meta");
    },
  });
}

async function readAll(db: Db): Promise<Doc> {
  const tx = db.transaction(["claims", "meta"]);
  const [claims, deleted] = await Promise.all([
    tx.objectStore("claims").getAll(),
    tx.objectStore("meta").get("deleted"),
    tx.done,
  ]);
  return { version: 3, claims, deleted: (deleted as Doc["deleted"] | undefined) ?? {} };
}

export function indexedDbStorage(db: Db, channelName = `${db.name}-changes`): Storage {
  const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(channelName);
  return {
    load: () => readAll(db),

    async save(doc) {
      // Read, merge and write in a single transaction so concurrent saves cannot interleave.
      const tx = db.transaction(["claims", "meta"], "readwrite");
      const claims = tx.objectStore("claims");
      const meta = tx.objectStore("meta");
      const stored: Doc = {
        version: 3,
        claims: await claims.getAll(),
        deleted: ((await meta.get("deleted")) as Doc["deleted"] | undefined) ?? {},
      };
      const merged = mergeDocs(stored, doc);
      const keep = new Set(merged.claims.map((c) => c.id));
      const byId = new Map(stored.claims.map((c) => [c.id, c]));
      const writes: Promise<unknown>[] = [];
      for (const c of stored.claims) if (!keep.has(c.id)) writes.push(claims.delete(c.id));
      for (const c of merged.claims) {
        const prev = byId.get(c.id);
        if (!prev || !sameClaim(prev, c)) writes.push(claims.put(c));
      }
      writes.push(meta.put(merged.deleted, "deleted"));
      await Promise.all([...writes, tx.done]);
      channel?.postMessage("saved");
      return merged;
    },

    onExternalChange(cb) {
      if (!channel) return () => {};
      const listener = () => cb();
      channel.addEventListener("message", listener);
      return () => channel.removeEventListener("message", listener);
    },
  };
}

function sameClaim(a: Claim, b: Claim): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export async function getMeta(db: Db, key: string): Promise<unknown> {
  return db.get("meta", key);
}

export async function setMeta(db: Db, key: string, value: unknown): Promise<void> {
  await db.put("meta", value, key);
}
