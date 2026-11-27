import type { Doc } from "../domain/types";

/**
 * Where the data lives. The app only talks to this interface, so the
 * IndexedDB implementation can later be replaced or wrapped (e.g. sync
 * between devices) without touching the rest of the code.
 */
export interface Storage {
  /** Everything currently stored (an empty doc the first time). */
  load(): Promise<Doc>;
  /**
   * Saves `doc` merged with what is already stored, and returns the result.
   * Merging (newest version of each expense wins, deletions tracked) means
   * two open windows never erase each other's changes.
   */
  save(doc: Doc): Promise<Doc>;
  /** Called when another window or tab saved; returns an unsubscribe function. */
  onExternalChange(cb: () => void): () => void;
}
