/**
 * Keeps a copy of the data in a file chosen by the user (File System Access API,
 * Chrome and Edge on a computer). IndexedDB stays the main storage; after every
 * change the whole data set is written to the file, so it is always up to date
 * and survives clearing the browser's data.
 */
import type { Doc } from "../domain/types";

/** The parts of FileSystemFileHandle we use (lets tests pass a fake). */
export interface FileHandleLike {
  readonly name: string;
  getFile(): Promise<{ text(): Promise<string> }>;
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
  queryPermission?(opts: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission?(opts: { mode: "readwrite" }): Promise<PermissionState>;
}

/** Where the chosen file handle is remembered between visits (IndexedDB). */
export interface HandleStore {
  get(): Promise<FileHandleLike | undefined>;
  set(handle: FileHandleLike | undefined): Promise<void>;
}

export type MirrorStatus =
  | { state: "off" }
  | { state: "active"; fileName: string; lastSaved?: number }
  /** The browser needs the user's permission again (usually after a restart). */
  | { state: "paused"; fileName: string }
  | { state: "error"; fileName: string };

const RW = { mode: "readwrite" } as const;

async function hasPermission(h: FileHandleLike): Promise<boolean> {
  if (!h.queryPermission) return true;
  return (await h.queryPermission(RW)) === "granted";
}

export class FileMirror {
  private handle: FileHandleLike | undefined;
  private current: MirrorStatus = { state: "off" };
  private listeners = new Set<(s: MirrorStatus) => void>();
  private pending: Doc | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private writing: Promise<void> = Promise.resolve();

  constructor(
    private store: HandleStore,
    private serialize: (doc: Doc) => string,
    private delayMs = 800,
    private now: () => number = Date.now,
  ) {}

  get status(): MirrorStatus {
    return this.current;
  }

  subscribe(cb: (s: MirrorStatus) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private set(s: MirrorStatus) {
    this.current = s;
    for (const cb of this.listeners) cb(s);
  }

  /** On startup: picks up the remembered file, then brings it up to date with `doc`. */
  async init(doc: Doc): Promise<void> {
    this.handle = await this.store.get();
    if (!this.handle) return this.set({ state: "off" });
    if (await hasPermission(this.handle)) {
      this.set({ state: "active", fileName: this.handle.name });
      await this.writeNow(doc);
    } else {
      this.pending = doc;
      this.set({ state: "paused", fileName: this.handle.name });
    }
  }

  /**
   * Starts mirroring to `handle`. Returns the file's previous text so the caller
   * can merge a backup it already contains; the file is written by the next `schedule`.
   */
  async enable(handle: FileHandleLike): Promise<string> {
    let previous = "";
    try {
      previous = await (await handle.getFile()).text();
    } catch {
      // new or unreadable file: nothing to merge
    }
    this.handle = handle;
    await this.store.set(handle);
    this.set({ state: "active", fileName: handle.name });
    return previous;
  }

  /** Asks the browser for permission again (must be called from a click). */
  async resume(): Promise<void> {
    const h = this.handle;
    if (!h) return;
    const state = h.requestPermission ? await h.requestPermission(RW) : "granted";
    if (state !== "granted") return;
    this.set({ state: "active", fileName: h.name });
    if (this.pending) await this.writeNow(this.pending);
  }

  async disable(): Promise<void> {
    clearTimeout(this.timer);
    this.handle = undefined;
    this.pending = undefined;
    await this.store.set(undefined);
    this.set({ state: "off" });
  }

  /** Called after every save: writes the file shortly after the last change. */
  schedule(doc: Doc): void {
    this.pending = doc;
    if (this.current.state !== "active") return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.writeNow(doc), this.delayMs);
  }

  /** Writes now (also used in tests and before closing). */
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    if (this.pending && this.current.state === "active") await this.writeNow(this.pending);
    await this.writing;
  }

  private writeNow(doc: Doc): Promise<void> {
    const h = this.handle;
    if (!h) return Promise.resolve();
    // One write at a time, in order.
    this.writing = this.writing.then(async () => {
      try {
        const w = await h.createWritable();
        await w.write(this.serialize(doc));
        await w.close();
        if (this.pending === doc) this.pending = undefined;
        this.set({ state: "active", fileName: h.name, lastSaved: this.now() });
      } catch (e) {
        // Permission withdrawn: ask again. Anything else (disk full, file moved…): show an error.
        const denied = e instanceof DOMException && e.name === "NotAllowedError";
        this.pending = doc;
        this.set(denied ? { state: "paused", fileName: h.name } : { state: "error", fileName: h.name });
      }
    });
    return this.writing;
  }
}

/** True in browsers that let a page write to a file the user picked (Chrome, Edge on a computer). */
export function fileSaveSupported(): boolean {
  return typeof window !== "undefined" && "showSaveFilePicker" in window;
}
