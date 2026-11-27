import { useEffect, useState } from "preact/hooks";
import { fileSaveSupported, type FileHandleLike, type FileMirror, type MirrorStatus } from "../storage/fileMirror";
import { importBackup } from "../domain/data";
import { parseBackup } from "../export/json";
import type { AppData } from "./useAppData";
import { strings } from "./strings";

export interface AutoSave {
  /** False when the browser cannot write to a chosen file (Firefox, Android…) or storage is unavailable. */
  supported: boolean;
  status: MirrorStatus;
  choose(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
}

type Picker = (opts: object) => Promise<FileHandleLike>;

export function useAutoSave(data: AppData, mirror: FileMirror | undefined, toast: (msg: string) => void): AutoSave {
  const [status, setStatus] = useState<MirrorStatus>(mirror?.status ?? { state: "off" });
  useEffect(() => {
    if (!mirror) return;
    setStatus(mirror.status);
    return mirror.subscribe(setStatus);
  }, [mirror]);

  const choose = async () => {
    if (!mirror) return;
    let handle: FileHandleLike;
    try {
      handle = await (window as unknown as { showSaveFilePicker: Picker }).showSaveFilePicker({
        suggestedName: strings.autosave.suggestedName,
        types: [{ description: strings.autosave.fileType, accept: { "application/json": [".json"] } }],
      });
    } catch {
      return; // picker closed
    }
    const previous = await mirror.enable(handle);
    // The file already holds a backup (same file chosen again, or from another computer): merge it first.
    let merged = false;
    if (previous.trim()) {
      try {
        const incoming = parseBackup(previous, data.today);
        data.updateDoc((current) => importBackup(current, incoming).doc);
        merged = true;
      } catch {
        // not a backup: it will simply be replaced
      }
    }
    if (!merged) mirror.schedule(data.doc);
    await mirror.flush();
    toast(strings.autosave.started(handle.name));
  };

  return {
    supported: !!mirror && fileSaveSupported(),
    status,
    choose,
    resume: async () => {
      await mirror?.resume();
    },
    stop: async () => {
      await mirror?.disable();
      toast(strings.autosave.stopped);
    },
  };
}
