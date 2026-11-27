import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { Claim, Doc, Timestamp, Ymd } from "../domain/types";
import { mergeDocs } from "../domain/data";
import { today as computeToday } from "../domain/dates";
import type { Storage } from "../storage/Storage";
import type { OpenedStorage } from "../storage/startup";

export interface AppData {
  doc: Doc;
  today: Ymd;
  persistent: boolean;
  migrated: number;
  saveError: boolean;
  /** Applies an action to one expense. `now` is always later than the expense's last change. */
  updateClaim: (id: string, action: (c: Claim, now: Timestamp) => Claim) => void;
  /** Applies a change to the whole data set (add, delete, import). */
  updateDoc: (change: (d: Doc, now: Timestamp) => Doc) => void;
}

/** Keeps the date current: re-checked every minute and when the app comes back to the foreground. */
function useToday(): Ymd {
  const [t, setT] = useState(computeToday());
  useEffect(() => {
    const check = () => setT(computeToday());
    const timer = setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  return t;
}

export function useAppData(opened: OpenedStorage): AppData {
  const storage: Storage = opened.storage;
  const [doc, setDoc] = useState<Doc>(opened.doc);
  const [saveError, setSaveError] = useState(false);
  const docRef = useRef(doc);
  docRef.current = doc;
  const today = useToday();

  const persist = useCallback(
    (next: Doc) => {
      docRef.current = next;
      setDoc(next);
      storage.save(next).then(
        // Merge rather than replace, so a change made while saving is not lost.
        (stored) => {
          setSaveError(false);
          opened.mirror?.schedule(stored);
          const merged = mergeDocs(docRef.current, stored);
          docRef.current = merged;
          setDoc(merged);
        },
        () => setSaveError(true),
      );
    },
    [storage, opened.mirror],
  );

  const updateClaim = useCallback<AppData["updateClaim"]>(
    (id, action) => {
      const cur = docRef.current;
      const c = cur.claims.find((x) => x.id === id);
      if (!c) return;
      const now = Math.max(Date.now(), c.mod + 1);
      const changed = action(c, now);
      persist({ ...cur, claims: cur.claims.map((x) => (x.id === id ? changed : x)) });
    },
    [persist],
  );

  const updateDoc = useCallback<AppData["updateDoc"]>(
    (change) => {
      const cur = docRef.current;
      const latest = cur.claims.reduce((t, c) => Math.max(t, c.mod), 0);
      persist(change(cur, Math.max(Date.now(), latest + 1)));
    },
    [persist],
  );

  // Another window saved: reload and merge.
  useEffect(
    () =>
      storage.onExternalChange(() => {
        void storage.load().then((stored) => {
          const merged = mergeDocs(docRef.current, stored);
          docRef.current = merged;
          setDoc(merged);
        });
      }),
    [storage],
  );

  return { doc, today, persistent: opened.persistent, migrated: opened.migrated, saveError, updateClaim, updateDoc };
}
