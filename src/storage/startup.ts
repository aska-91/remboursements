import type { Doc } from "../domain/types";
import { readDoc } from "../domain/data";
import { today } from "../domain/dates";
import type { Storage } from "./Storage";
import { getMeta, indexedDbStorage, openDatabase, setMeta, type Db } from "./indexedDb";
import { memoryStorage } from "./memory";

/** Keys the single-file prototype used in localStorage. */
export const PROTOTYPE_KEYS = ["remboursements-v2", "remboursements-v1"];
const MIGRATED_FLAG = "prototypeMigrated";

export interface OpenedStorage {
  storage: Storage;
  doc: Doc;
  /** False when IndexedDB is unavailable (e.g. some private windows): data will not survive a reload. */
  persistent: boolean;
  /** Number of expenses taken over from the prototype on this start (0 if none). */
  migrated: number;
}

/**
 * Copies the prototype's data the first time the app starts, if it was used in
 * this browser at this same address. The prototype's copy is left untouched.
 */
export async function migratePrototype(db: Db, storage: Storage, local: Pick<globalThis.Storage, "getItem"> | undefined): Promise<number> {
  if (await getMeta(db, MIGRATED_FLAG)) return 0;
  let count = 0;
  try {
    const raw = PROTOTYPE_KEYS.map((k) => local?.getItem(k)).find((v) => v);
    if (raw) {
      const doc = readDoc(JSON.parse(raw), today());
      await storage.save(doc);
      count = doc.claims.length;
    }
  } catch {
    // Unreadable prototype data: ignore it rather than block the app.
  }
  await setMeta(db, MIGRATED_FLAG, Date.now());
  return count;
}

function browserLocalStorage(): globalThis.Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export async function openStorage(): Promise<OpenedStorage> {
  let db: Db;
  try {
    db = await openDatabase();
  } catch {
    const storage = memoryStorage();
    return { storage, doc: await storage.load(), persistent: false, migrated: 0 };
  }
  const storage = indexedDbStorage(db);
  const migrated = await migratePrototype(db, storage, browserLocalStorage());
  // Ask the browser not to clear our data when space runs low (granted silently or not at all).
  void navigator.storage?.persist?.().catch(() => false);
  return { storage, doc: await storage.load(), persistent: true, migrated };
}
