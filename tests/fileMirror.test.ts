import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileMirror, type FileHandleLike } from "../src/storage/fileMirror";
import type { Doc } from "../src/domain/types";
import { claim } from "./fixtures";

const doc = (n: number): Doc => ({ version: 3, claims: Array.from({ length: n }, (_, k) => claim({ id: `c${k}` })), deleted: {} });

function fakeFile(opts: { content?: string; permission?: PermissionState; failWith?: string } = {}) {
  const f = {
    content: opts.content ?? "",
    writes: 0,
    permission: opts.permission ?? ("granted" as PermissionState),
    failWith: opts.failWith,
    handle: {} as FileHandleLike,
  };
  f.handle = {
    name: "data.json",
    getFile: async () => ({ text: async () => f.content }),
    createWritable: async () => {
      if (f.failWith) throw new DOMException("fail", f.failWith);
      let buf = "";
      return { write: async (d: string) => { buf = d; }, close: async () => { f.content = buf; f.writes++; } };
    },
    queryPermission: async () => f.permission,
    requestPermission: async () => { f.permission = "granted"; return "granted"; },
  };
  return f;
}

function memoryHandleStore(initial?: FileHandleLike) {
  let h = initial;
  return { get: async () => h, set: async (x: FileHandleLike | undefined) => { h = x; } };
}

const serialize = (d: Doc) => JSON.stringify(d);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("automatic save to a file", () => {
  it("is off until a file is chosen", async () => {
    const m = new FileMirror(memoryHandleStore(), serialize);
    await m.init(doc(1));
    expect(m.status).toEqual({ state: "off" });
  });

  it("writes the data shortly after the last change, grouping close changes", async () => {
    const f = fakeFile();
    const m = new FileMirror(memoryHandleStore(), serialize, 800, () => 42);
    expect(await m.enable(f.handle)).toBe("");
    m.schedule(doc(1));
    m.schedule(doc(2));
    m.schedule(doc(3));
    await vi.advanceTimersByTimeAsync(900);
    expect(f.writes).toBe(1);
    expect(JSON.parse(f.content).claims).toHaveLength(3);
    expect(m.status).toEqual({ state: "active", fileName: "data.json", lastSaved: 42 });
  });

  it("returns what the chosen file already contained, so it can be merged", async () => {
    const f = fakeFile({ content: '{"version":3,"claims":[]}' });
    const m = new FileMirror(memoryHandleStore(), serialize);
    expect(await m.enable(f.handle)).toBe('{"version":3,"claims":[]}');
  });

  it("on startup with permission: picks the file up again and brings it up to date", async () => {
    const f = fakeFile();
    const m = new FileMirror(memoryHandleStore(f.handle), serialize);
    await m.init(doc(2));
    expect(m.status.state).toBe("active");
    expect(JSON.parse(f.content).claims).toHaveLength(2);
  });

  it("on startup without permission: paused, then resumes and writes the latest data on request", async () => {
    const f = fakeFile({ permission: "prompt" });
    const m = new FileMirror(memoryHandleStore(f.handle), serialize);
    await m.init(doc(1));
    expect(m.status).toEqual({ state: "paused", fileName: "data.json" });
    m.schedule(doc(4)); // changes while paused are kept
    await vi.advanceTimersByTimeAsync(1000);
    expect(f.writes).toBe(0);
    await m.resume();
    expect(m.status.state).toBe("active");
    expect(JSON.parse(f.content).claims).toHaveLength(4);
  });

  it("permission withdrawn while writing: paused; other failures: error", async () => {
    const denied = fakeFile({ failWith: "NotAllowedError" });
    const m1 = new FileMirror(memoryHandleStore(), serialize);
    await m1.enable(denied.handle);
    m1.schedule(doc(1));
    await m1.flush();
    expect(m1.status.state).toBe("paused");
    const broken = fakeFile({ failWith: "NotFoundError" });
    const m2 = new FileMirror(memoryHandleStore(), serialize);
    await m2.enable(broken.handle);
    m2.schedule(doc(1));
    await m2.flush();
    expect(m2.status.state).toBe("error");
  });

  it("stop: forgets the file and writes nothing more", async () => {
    const f = fakeFile();
    const store = memoryHandleStore();
    const m = new FileMirror(store, serialize);
    await m.enable(f.handle);
    expect(await store.get()).toBe(f.handle);
    m.schedule(doc(1));
    await m.disable();
    await vi.advanceTimersByTimeAsync(1000);
    expect(f.writes).toBe(0);
    expect(await store.get()).toBeUndefined();
    expect(m.status).toEqual({ state: "off" });
  });
});
