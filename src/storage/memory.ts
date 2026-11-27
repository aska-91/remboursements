import type { Doc } from "../domain/types";
import { emptyDoc, mergeDocs } from "../domain/data";
import type { Storage } from "./Storage";

/** In-memory storage, for tests and as a fallback when IndexedDB is unavailable. */
export function memoryStorage(initial: Doc = emptyDoc()): Storage {
  let stored = structuredClone(initial);
  return {
    async load() {
      return structuredClone(stored);
    },
    async save(doc) {
      stored = mergeDocs(stored, structuredClone(doc));
      return structuredClone(stored);
    },
    onExternalChange() {
      return () => {};
    },
  };
}
