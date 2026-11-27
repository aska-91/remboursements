import { useEffect, useRef } from "preact/hooks";
import { buildCsv } from "../export/csv";
import { buildBackup, parseBackup } from "../export/json";
import { importBackup } from "../domain/data";
import type { AppData } from "./useAppData";
import { strings } from "./strings";

const B = strings.backup;

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

export function BackupMenu({ data, toast }: { data: AppData; toast: (msg: string) => void }) {
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
    download(B.csvFile(data.today), buildCsv(data.doc.claims, data.today), "text/csv;charset=utf-8");
    toast(B.exported);
  };
  const exportJson = () => {
    close();
    download(B.jsonFile(data.today), buildBackup(data.doc, Date.now()), "application/json");
    toast(B.exported);
  };
  const onFile = async () => {
    const f = file.current?.files?.[0];
    if (!f) return;
    try {
      const incoming = parseBackup(await f.text(), data.today);
      let result = { added: 0, updated: 0, removed: 0 };
      data.updateDoc((current) => {
        const r = importBackup(current, incoming);
        result = r;
        return r.doc;
      });
      toast(B.imported(result.added, result.updated, result.removed));
    } catch {
      toast(B.invalidFile);
    } finally {
      file.current!.value = "";
    }
  };

  return (
    <details class="menu" ref={menu}>
      <summary class="btn">{B.menu}</summary>
      <div class="menu-pop" role="group" aria-label={B.menu}>
        <button type="button" onClick={exportCsv}>{B.exportCsv}</button>
        <button type="button" onClick={exportJson}>{B.exportJson}</button>
        <button type="button" onClick={() => { close(); file.current?.click(); }}>{B.importJson}</button>
        <p class="hint">{B.hint}</p>
      </div>
      <input ref={file} type="file" accept=".json,application/json" hidden onChange={onFile} />
    </details>
  );
}
