import { useEffect, useRef } from "preact/hooks";
import { buildCsv } from "../export/csv";
import { buildBackup, parseBackup } from "../export/json";
import { importBackup } from "../domain/data";
import type { AppData } from "./useAppData";
import type { ConfirmConfig } from "./dialogs/ConfirmDialog";
import type { AutoSave } from "./useAutoSave";
import { strings } from "./strings";


/** Saves text as a file through the browser's download (works offline, nothing is sent anywhere). */
function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

interface Props {
  data: AppData;
  toast: (msg: string) => void;
  confirm: (cfg: ConfirmConfig) => void;
  autosave: AutoSave;
}

export function BackupMenu({ data, toast, confirm, autosave }: Props) {
  const menu = useRef<HTMLDetailsElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const close = () => { if (menu.current) menu.current.open = false; };

  // Close the menu on an outside click or Escape.
  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (menu.current?.open && !menu.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && menu.current?.open) { close(); menu.current.querySelector("summary")?.focus(); }
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("click", onClick); document.removeEventListener("keydown", onKey); };
  }, []);

  const exportCsv = () => {
    close();
    download(strings.backup.csvFile(data.today), buildCsv(data.doc.claims, data.today), "text/csv;charset=utf-8");
    toast(strings.backup.exported);
  };
  const exportJson = () => {
    close();
    download(strings.backup.jsonFile(data.today), buildBackup(data.doc, Date.now()), "application/json");
    toast(strings.backup.exported);
  };
  const onFile = async () => {
    const f = file.current?.files?.[0];
    if (!f) return;
    try {
      const incoming = parseBackup(await f.text(), data.today);
      // Ask first, as the prototype did: the merge loses nothing but changes the data.
      confirm({
        title: strings.backup.confirmTitle,
        message: strings.backup.confirmMessage(incoming.claims.length),
        okLabel: strings.backup.confirmOk,
        onOk: () => {
          let result = { added: 0, updated: 0, removed: 0 };
          data.updateDoc((current) => {
            const r = importBackup(current, incoming);
            result = r;
            return r.doc;
          });
          toast(strings.backup.imported(result.added, result.updated, result.removed));
        },
      });
    } catch {
      toast(strings.backup.invalidFile);
    } finally {
      file.current!.value = "";
    }
  };

  return (
    <details class="menu" ref={menu}>
      <summary class="btn">{strings.backup.menu}</summary>
      <div class="menu-pop" role="group" aria-label={strings.backup.menu}>
        <button type="button" onClick={exportCsv}>{strings.backup.exportCsv}</button>
        <button type="button" onClick={exportJson}>{strings.backup.exportJson}</button>
        <button type="button" onClick={() => { close(); file.current?.click(); }}>{strings.backup.importJson}</button>
        <p class="hint">{strings.backup.hint}</p>
        <div class="menu-section" aria-label={strings.autosave.title} role="group">
          <strong>{strings.autosave.title}</strong>
          {!autosave.supported ? (
            <p class="hint">{strings.autosave.unsupported}</p>
          ) : autosave.status.state === "off" ? (
            <>
              <button type="button" onClick={() => { close(); void autosave.choose(); }}>{strings.autosave.choose}</button>
              <p class="hint">{strings.autosave.help}</p>
            </>
          ) : (
            <>
              <p class={`hint${autosave.status.state === "active" ? " autosave-state" : ""}`} role="status">
                {autosave.status.state === "active"
                  ? strings.autosave.active(autosave.status.fileName, autosave.status.lastSaved)
                  : autosave.status.state === "paused"
                    ? strings.autosave.paused(autosave.status.fileName)
                    : strings.autosave.error(autosave.status.fileName)}
              </p>
              <button type="button" onClick={() => { close(); void autosave.choose(); }}>{strings.autosave.chooseAgain}</button>
              <button type="button" onClick={() => { close(); void autosave.stop(); }}>{strings.autosave.stop}</button>
            </>
          )}
        </div>
      </div>
      <input ref={file} type="file" accept=".json,application/json" hidden onChange={onFile} />
    </details>
  );
}
